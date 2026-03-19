import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../firebase';
import { useAuth } from '../../context/useAuth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import CameraModal from './CameraModal';
import './TimeTracking.css';

const TimeTracking = ({ selectedUser }) => {
  const { user } = useAuth();

  // Stores the current work status of the user
  // possible values: idle, working, on_break, offline
  const [status, setStatus] = useState('idle');

  // Live clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // Prevents multiple clicks while saving log
  const [loading, setLoading] = useState(false);

  // Controls camera modal visibility
  const [cameraOpen, setCameraOpen] = useState(false);

  // Stores camera-related error messages
  const [cameraError, setCameraError] = useState('');

  // Stores captured image as base64
  const [photoDataUrl, setPhotoDataUrl] = useState('');

  // Stores which action is waiting for photo confirmation
  // example: time_in, break_out, break_in, time_out
  const [pendingType, setPendingType] = useState('');

  // Refs for video, canvas, and media stream
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Updates the live clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Determines the current user status based on today's record
  const updateStatus = useCallback((record) => {
    if (
      !record ||
      (!record.timeIn && !record.timeOut && !record.breakOut && !record.breakIn)
    ) {
      setStatus('idle');
      return;
    }

    // If timeOut exists, user is already done for the day
    if (record.timeOut) {
      setStatus('offline');
      return;
    }

    // If breakOut exists but breakIn does not, user is currently on break
    if (record.breakOut && !record.breakIn) {
      setStatus('on_break');
      return;
    }

    // If timeIn or breakIn exists, user is considered working
    if (record.timeIn || record.breakIn) {
      setStatus('working');
      return;
    }

    setStatus('idle');
  }, []);

  // Stops only the camera stream but keeps modal state available
  const stopStreamOnly = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Fully closes the camera modal
  const stopCamera = useCallback(() => {
    stopStreamOnly();
    setCameraOpen(false);
  }, [stopStreamOnly]);

  // Fetch today's DTR record from Firestore
  const fetchTodayLogs = useCallback(async () => {
    if (!selectedUser) return;

    const dateKey = getDateKey(new Date());
    const docRef = doc(db, 'dtr', `${selectedUser.id}_${dateKey}`);

    try {
      const snap = await getDoc(docRef);

      // If no record exists yet, reset status
      if (!snap.exists()) {
        setStatus('idle');
        return;
      }

      const record = snap.data();
      updateStatus(record);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  }, [selectedUser, updateStatus]);

  // Cleanup: stop the camera when component unmounts
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Fetch today's logs whenever selected user changes
  useEffect(() => {
    fetchTodayLogs();
  }, [fetchTodayLogs]);

  // Saves a specific log action to Firestore
  const addLog = useCallback(async (type, photoUrl = '') => {
    if (!user || !selectedUser) return;

    setLoading(true);

    try {
      const dateKey = getDateKey(new Date());
      const docRef = doc(db, 'dtr', `${selectedUser.id}_${dateKey}`);

      // Base fields stored in the record
      const update = {
        userId: selectedUser.id,
        userName: selectedUser.name,
        userEmail: user.email,
        dateKey,
      };

      // Save timestamp and optional photo depending on action type
      if (type === 'time_in') {
        update.timeIn = Timestamp.now();
        if (photoUrl) update.timeInPhoto = photoUrl;
      }

      if (type === 'break_out') {
        update.breakOut = Timestamp.now();
        if (photoUrl) update.breakOutPhoto = photoUrl;
      }

      if (type === 'break_in') {
        update.breakIn = Timestamp.now();
        if (photoUrl) update.breakInPhoto = photoUrl;
      }

      if (type === 'time_out') {
        update.timeOut = Timestamp.now();
        if (photoUrl) update.timeOutPhoto = photoUrl;
      }

      // merge:true prevents overwriting the whole document
      await setDoc(docRef, update, { merge: true });

      // Refresh logs after saving
      await fetchTodayLogs();
    } catch (error) {
      alert('Error recording time: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [user, selectedUser, fetchTodayLogs]);

  // Returns "active" class when button matches current status
  const getButtonClass = (buttonType) => {
    return buttonType === status ? 'active' : '';
  };

  // Wait until video metadata is ready before capturing photo
  const waitForVideoReady = useCallback((video) => {
    if (!video) return Promise.resolve();

    if (video.readyState >= 2 && video.videoWidth > 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const onReady = () => {
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        resolve();
      };

      video.addEventListener('loadeddata', onReady, { once: true });
      video.addEventListener('canplay', onReady, { once: true });
    });
  }, []);

  // Wait for the video element to exist in the DOM
  const waitForVideoElement = useCallback(() => {
    return new Promise((resolve) => {
      if (videoRef.current) return resolve(videoRef.current);

      const start = performance.now();

      const tick = () => {
        if (videoRef.current) return resolve(videoRef.current);
        if (performance.now() - start > 2000) return resolve(null);
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }, []);

  // Opens the camera and starts video preview
  const startCamera = useCallback(async () => {
    setCameraError('');
    setCameraOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      const videoEl = await waitForVideoElement();

      if (!videoEl) {
        setCameraError('Unable to initialize camera preview.');
        stopCamera();
        return;
      }

      videoEl.srcObject = stream;
      await videoEl.play();
    } catch (err) {
      setCameraError(err.message || 'Camera permission denied.');
      setCameraOpen(false);
      setPendingType('');
    }
  }, [stopCamera, waitForVideoElement]);

  // Captures current frame from video and stores it as image
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    await waitForVideoReady(video);

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoDataUrl(dataUrl);

    // Stop live stream after photo is captured
    stopStreamOnly();
  }, [stopStreamOnly, waitForVideoReady]);

  // Confirms the captured photo and saves the pending log
  const confirmPhoto = useCallback(() => {
    if (!pendingType || !photoDataUrl) return;

    const typeToLog = pendingType;
    setPendingType('');
    stopCamera();
    addLog(typeToLog, photoDataUrl);
  }, [addLog, pendingType, photoDataUrl, stopCamera]);

  // Clears current photo and opens camera again
  const retakePhoto = useCallback(async () => {
    setPhotoDataUrl('');
    await startCamera();
  }, [startCamera]);

  // Starts camera for a specific log action
  const handleCameraFor = async (type) => {
    setPhotoDataUrl('');
    setPendingType(type);
    await startCamera();
  };

  return (
    <div className="time-tracking">
      <div className="time-card">
        <h2>Current Time</h2>
        <div className="digital-clock">
          {currentTime.toLocaleTimeString()}
        </div>
        <p className="date">{currentTime.toLocaleDateString()}</p>
      </div>

      <div className="controls-card">
        <h2>Actions</h2>
        <div className="button-layout">
          <button
            className={`action-btn time-in ${getButtonClass('working')} ${loading ? 'disabled' : ''}`}
            onClick={() => handleCameraFor('time_in')}
            disabled={loading}
          >
            <img className="action-icon" src="/icons/time-in.svg" alt="" aria-hidden="true" />
            <span>Time In</span>
          </button>

          <div className="button-row button-row-middle">
            <button
              className={`action-btn break-out ${getButtonClass('on_break')} ${loading ? 'disabled' : ''}`}
              onClick={() => handleCameraFor('break_out')}
              disabled={loading}
            >
              <img className="action-icon" src="/icons/break-in.svg" alt="" aria-hidden="true" />
              <span>Break Out</span>
            </button>

            <button
              className={`action-btn break-in ${getButtonClass('working')} ${loading ? 'disabled' : ''}`}
              onClick={() => handleCameraFor('break_in')}
              disabled={loading}
            >
              <img className="action-icon" src="/icons/break-out.svg" alt="" aria-hidden="true" />
              <span>Break In</span>
            </button>
          </div>

          <button
            className={`action-btn time-out ${getButtonClass('offline')} ${loading ? 'disabled' : ''}`}
            onClick={() => handleCameraFor('time_out')}
            disabled={loading}
          >
            <img className="action-icon" src="/icons/time-out.svg" alt="" aria-hidden="true" />
            <span>Time Out</span>
          </button>
        </div>
      </div>

      <div className="status-card">
        <h2>Status</h2>
        <div className={`status-badge ${status}`}>
          {`Status: ${status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())}`}
        </div>
      </div>

      <CameraModal
        cameraError={cameraError}
        cameraOpen={cameraOpen}
        photoDataUrl={photoDataUrl}
        setPendingType={setPendingType}
        setPhotoDataUrl={setPhotoDataUrl}
        setCameraError={setCameraError}
        stopCamera={stopCamera}
        videoRef={videoRef}
        canvasRef={canvasRef}
        capturePhoto={capturePhoto}
        retakePhoto={retakePhoto}
        confirmPhoto={confirmPhoto}
      />
    </div>
  );
};

// Creates document key in YYYY-MM-DD format
const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default TimeTracking;

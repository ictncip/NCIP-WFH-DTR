import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../firebase';
import { useAuth } from '../../context/useAuth';
import { collection, doc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore';
import CameraModal from './CameraModal';
import { buildDtrDocumentId } from '../../utils/dtrDocumentId';
import './TimeTracking.css';

const TimeTracking = ({ selectedUser }) => {
  const { user } = useAuth();

  // Stores the current work status of the user
  // possible values: idle, working, on_break, offline
  const [status, setStatus] = useState('idle');
  const [todayRecord, setTodayRecord] = useState(null);

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
  const [pendingAccomplishment, setPendingAccomplishment] = useState('');
  const [accomplishmentModalOpen, setAccomplishmentModalOpen] = useState(false);
  const [accomplishmentInput, setAccomplishmentInput] = useState('');
  const [accomplishmentError, setAccomplishmentError] = useState('');
  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
  const [duplicateActionType, setDuplicateActionType] = useState('');

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

    try {
      const baseRef = collection(db, 'dtr');
      const todayQuery = query(
        baseRef,
        where('userId', '==', selectedUser.id),
        where('dateKey', '==', dateKey)
      );
      const snapshot = await getDocs(todayQuery);

      // If no record exists yet, reset status
      if (snapshot.empty) {
        setTodayRecord(null);
        setStatus('idle');
        return;
      }

      const expectedId = buildDtrDocumentId({
        dateKey,
        userName: selectedUser.name,
        userId: selectedUser.id
      });
      const matchingDoc = snapshot.docs.find((entry) => entry.id === expectedId) || snapshot.docs[0];
      const record = matchingDoc.data();
      setTodayRecord({ _docId: matchingDoc.id, ...record });
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
  const addLog = useCallback(async (type, photoUrl = '', accomplishment = '') => {
    if (!user || !selectedUser) return;

    setLoading(true);

    try {
      const dateKey = getDateKey(new Date());
      const documentId = todayRecord?._docId || buildDtrDocumentId({
        dateKey,
        userName: selectedUser.name,
        userId: selectedUser.id
      });
      const docRef = doc(db, 'dtr', documentId);

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
        if (accomplishment) update.breakOutAccomplishment = accomplishment;
      }

      if (type === 'break_in') {
        update.breakIn = Timestamp.now();
        if (photoUrl) update.breakInPhoto = photoUrl;
      }

      if (type === 'time_out') {
        update.timeOut = Timestamp.now();
        if (photoUrl) update.timeOutPhoto = photoUrl;
        if (accomplishment) update.timeOutAccomplishment = accomplishment;
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
  }, [user, selectedUser, todayRecord, fetchTodayLogs]);

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
    const accomplishment = pendingAccomplishment;
    setPendingType('');
    setPendingAccomplishment('');
    stopCamera();
    addLog(typeToLog, photoDataUrl, accomplishment);
  }, [addLog, pendingAccomplishment, pendingType, photoDataUrl, stopCamera]);

  // Clears current photo and opens camera again
  const retakePhoto = useCallback(async () => {
    setPhotoDataUrl('');
    await startCamera();
  }, [startCamera]);

  // Starts camera for a specific log action
  const openAccomplishmentModal = (type) => {
    setPendingType(type);
    setPendingAccomplishment('');
    setAccomplishmentInput('');
    setAccomplishmentError('');
    setAccomplishmentModalOpen(true);
  };

  const closeAccomplishmentModal = () => {
    setAccomplishmentModalOpen(false);
    setAccomplishmentInput('');
    setAccomplishmentError('');
    setPendingType('');
    setPendingAccomplishment('');
  };

  const closeDuplicateWarning = () => {
    setDuplicateWarningOpen(false);
    setDuplicateActionType('');
  };

  const proceedWithLogAction = async (type) => {
    if (type === 'break_out' || type === 'time_out') {
      openAccomplishmentModal(type);
      return;
    }

    setPhotoDataUrl('');
    setPendingAccomplishment('');
    setPendingType(type);
    await startCamera();
  };

  const submitAccomplishment = async () => {
    const trimmed = accomplishmentInput.trim();
    if (!trimmed) {
      setAccomplishmentError('Please type your accomplishment before continuing.');
      return;
    }

    setPendingAccomplishment(trimmed);
    setAccomplishmentError('');
    setAccomplishmentModalOpen(false);
    await startCamera();
  };

  const accomplishmentHeading = pendingType === 'time_out'
    ? 'Afternoon Accomplishment'
    : 'Morning Accomplishment';

  const duplicateActionLabel = (type) => {
    const labels = {
      time_in: 'TIME IN',
      break_out: 'BREAK OUT',
      break_in: 'BREAK IN',
      time_out: 'TIME OUT'
    };

    return labels[type] || 'LOG';
  };

  const handleCameraFor = async (type) => {
    if (hasExistingLog(todayRecord, type)) {
      setDuplicateActionType(type);
      setDuplicateWarningOpen(true);
      return;
    }

    await proceedWithLogAction(type);
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

      {duplicateWarningOpen && (
        <div className="accomplishment-overlay" role="dialog" aria-modal="true">
          <div className="accomplishment-modal warning-modal">
            <h3>Warning</h3>
            <p className="accomplishment-copy">
              {`You already have a ${duplicateActionLabel(duplicateActionType)} today.`}
            </p>
            <p className="accomplishment-copy">Do you want to continue?</p>
            <div className="accomplishment-actions">
              <button type="button" className="accomplishment-btn accomplishment-cancel" onClick={closeDuplicateWarning}>
                Cancel
              </button>
              <button
                type="button"
                className="accomplishment-btn accomplishment-continue"
                onClick={async () => {
                  const type = duplicateActionType;
                  closeDuplicateWarning();
                  await proceedWithLogAction(type);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {accomplishmentModalOpen && (
        <div className="accomplishment-overlay" role="dialog" aria-modal="true">
          <div className="accomplishment-modal">
            <h3>{accomplishmentHeading}</h3>
            <p className="accomplishment-copy">Please type your accomplishment before continuing.</p>
            <textarea
              id="accomplishment-input"
              className="accomplishment-input"
              value={accomplishmentInput}
              onChange={(e) => {
                setAccomplishmentInput(e.target.value);
                if (accomplishmentError) setAccomplishmentError('');
              }}
              placeholder="Type your accomplishment here"
              rows={4}
            />
            {accomplishmentError && <p className="accomplishment-error">{accomplishmentError}</p>}
            <div className="accomplishment-actions">
              <button type="button" className="accomplishment-btn accomplishment-cancel" onClick={closeAccomplishmentModal}>
                Cancel
              </button>
              <button type="button" className="accomplishment-btn accomplishment-continue" onClick={submitAccomplishment}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <CameraModal
        cameraError={cameraError}
        cameraOpen={cameraOpen}
        photoDataUrl={photoDataUrl}
        setPendingType={setPendingType}
        setPendingAccomplishment={setPendingAccomplishment}
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

const hasExistingLog = (record, type) => {
  if (!record) return false;

  const fieldMap = {
    time_in: 'timeIn',
    break_out: 'breakOut',
    break_in: 'breakIn',
    time_out: 'timeOut'
  };

  return Boolean(record[fieldMap[type]]);
};

export default TimeTracking;

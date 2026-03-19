import { useCallback, useEffect, useRef, useState } from "react";
import "./CameraModal.css";

const CameraModal = ({
  cameraError,
  cameraOpen,
  photoDataUrl,
  setPendingType,
  setPendingAccomplishment,
  setPhotoDataUrl,
  stopCamera,
  videoRef,
  canvasRef,
  capturePhoto,
  retakePhoto,
  confirmPhoto,
  setCameraError,
}) => {
  const [countdown, setCountdown] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [faceStatus, setFaceStatus] = useState("NO_FACE");
  const [countdownAnimate, setCountdownAnimate] = useState(false);

  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const modelLoadedRef = useRef(false);
  const faceapiRef = useRef(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const faceapi = await import("face-api.js");
        faceapiRef.current = faceapi;
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        modelLoadedRef.current = true;
      } catch (err) {
        console.error("Model load error:", err);
        setCameraError("Failed to load face detection model.");
      }
    };

    loadModels();

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
    };
  }, [setCameraError]);

  const isFaceCentered = (box, videoWidth, videoHeight) => {
    const faceCenterX = box.x + box.width / 2;
    const faceCenterY = box.y + box.height / 2;

    const centerX = videoWidth / 2;
    const centerY = videoHeight / 2;

    const toleranceX = videoWidth * 0.15;
    const toleranceY = videoHeight * 0.2;

    return (
      Math.abs(faceCenterX - centerX) < toleranceX &&
      Math.abs(faceCenterY - centerY) < toleranceY
    );
  };

  const triggerCountdownAnimation = useCallback(() => {
    setCountdownAnimate(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setCountdownAnimate(true);
      });
    });

    setTimeout(() => {
      setCountdownAnimate(false);
    }, 280);
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    setCountdown(null);
    setIsScanning(false);
    setCountdownAnimate(false);
  }, []);

  const startCountdown = useCallback(() => {
    if (countdownRef.current) return;

    setIsScanning(true);
    setCountdown(3);
    triggerCountdownAnimation();

    let count = 3;

    countdownRef.current = setInterval(() => {
      count -= 1;

      if (count === 0) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        setCountdown(null);
        setIsScanning(false);
        setCountdownAnimate(false);
        capturePhoto();
        return;
      }

      setCountdown(count);
      triggerCountdownAnimation();
    }, 1000);
  }, [capturePhoto, triggerCountdownAnimation]);

  useEffect(() => {
    if (!cameraOpen || photoDataUrl) return;
    if (!modelLoadedRef.current) return;

    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const faceapi = faceapiRef.current;
        if (!faceapi) return;

        const detections = await faceapi.detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions()
        );

        if (detections.length === 0) {
          setFaceStatus("NO_FACE");
          stopCountdown();
          return;
        }

        if (detections.length > 1) {
          setFaceStatus("MULTIPLE");
          stopCountdown();
          return;
        }

        const box = detections[0].box;
        const centered = isFaceCentered(
          box,
          video.videoWidth,
          video.videoHeight
        );

        if (!centered) {
          setFaceStatus("NOT_CENTERED");
          stopCountdown();
          return;
        }

        setFaceStatus("READY");
        startCountdown();
      } catch (err) {
        console.error("Detection error:", err);
      }
    }, 700);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [cameraOpen, photoDataUrl, startCountdown, stopCountdown, videoRef]);

  const handleCancel = () => {
    setPendingType("");
    setPendingAccomplishment("");
    setPhotoDataUrl("");
    stopCamera();
    setCameraError("");
    setFaceStatus("NO_FACE");
    stopCountdown();
    clearInterval(intervalRef.current);
  };

  const handleRetake = () => {
    setPhotoDataUrl("");
    setFaceStatus("NO_FACE");
    setCameraError("");
    stopCountdown();
    retakePhoto();
  };

  if (!cameraOpen) return null;

  return (
    <div className="camera-modal-overlay" role="dialog" aria-modal="true">
      <div className="camera-modal">
        {cameraError && <p className="camera-error">{cameraError}</p>}

        <div className="camera-modal-body">
          {!photoDataUrl ? (
            <div className="camera-frame">
              <div className="camera-container">
                <canvas ref={canvasRef} className="camera-canvas" />

                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="camera-video"
                />

                <div
                  className={`face-outline ${
                    faceStatus === "NO_FACE"
                      ? "no-face"
                      : faceStatus === "NOT_CENTERED"
                      ? "not-centered"
                      : faceStatus === "READY"
                      ? "ready"
                      : ""
                  }`}
                />

                <p className={`camera-instruction status-${faceStatus}`}>
                  {faceStatus === "NO_FACE" && "No face detected"}
                  {faceStatus === "MULTIPLE" && "Only one person allowed"}
                  {faceStatus === "NOT_CENTERED" && "Center your face"}
                  {faceStatus === "READY" && "Hold still..."}
                </p>

                {isScanning && <div className="scan-line"></div>}

                {countdown !== null && (
                  <div
                    className={`countdown ${
                      countdownAnimate ? "countdown-pop" : ""
                    }`}
                  >
                    {countdown}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="photo-review">
              <img src={photoDataUrl} alt="Captured face" />
            </div>
          )}
        </div>

        <div
          className={`camera-controls ${
            photoDataUrl ? "camera-controls-review" : "camera-controls-live"
          }`}
        >
          <button className="camera-btn cancel-btn" onClick={handleCancel}>
            Cancel
          </button>

          {photoDataUrl && (
            <button className="camera-btn retake-btn" onClick={handleRetake}>
              Retake
            </button>
          )}

          <button
            className="camera-btn use-btn"
            onClick={confirmPhoto}
            disabled={!photoDataUrl}
          >
            Use Photo
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraModal;

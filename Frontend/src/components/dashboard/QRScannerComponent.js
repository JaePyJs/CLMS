"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = QRScannerComponent;
var react_1 = require("react");
var card_1 = require("@/components/ui/card");
var button_1 = require("@/components/ui/button");
var badge_1 = require("@/components/ui/badge");
var input_1 = require("@/components/ui/input");
var label_1 = require("@/components/ui/label");
var select_1 = require("@/components/ui/select");
var switch_1 = require("@/components/ui/switch");
var sonner_1 = require("sonner");
var lucide_react_1 = require("lucide-react");
var library_1 = require("@zxing/library");
function QRScannerComponent(_a) {
    var _this = this;
    var onScanSuccess = _a.onScanSuccess, onScanError = _a.onScanError, _b = _a.enabled, enabled = _b === void 0 ? true : _b, _c = _a.showSettings, showSettings = _c === void 0 ? true : _c, _d = _a.className, className = _d === void 0 ? "" : _d;
    var _e = (0, react_1.useState)(false), isScanning = _e[0], setIsScanning = _e[1];
    var _f = (0, react_1.useState)(false), hasCamera = _f[0], setHasCamera = _f[1];
    var _g = (0, react_1.useState)(''), selectedCamera = _g[0], setSelectedCamera = _g[1];
    var _h = (0, react_1.useState)([]), cameras = _h[0], setCameras = _h[1];
    var _j = (0, react_1.useState)(null), lastResult = _j[0], setLastResult = _j[1];
    var _k = (0, react_1.useState)({
        totalScans: 0,
        successfulScans: 0,
        failedScans: 0,
        averageScanTime: 0,
        lastScanTime: null,
    }), statistics = _k[0], setStatistics = _k[1];
    var _l = (0, react_1.useState)({
        autoStart: false,
        continuous: false,
        beepOnScan: true,
        vibrateOnScan: true,
        showOverlay: true,
        torchEnabled: false,
        scanDelay: 1000,
        maxResolutions: true,
    }), settings = _l[0], setSettings = _l[1];
    var videoRef = (0, react_1.useRef)(null);
    var codeReaderRef = (0, react_1.useRef)(null);
    var streamRef = (0, react_1.useRef)(null);
    var scanTimeoutRef = (0, react_1.useRef)(null);
    var lastScanTimeRef = (0, react_1.useRef)(0);
    // Initialize QR code reader
    (0, react_1.useEffect)(function () {
        if (enabled) {
            initializeQRReader();
            checkCameraAvailability();
        }
        return function () {
            cleanup();
        };
    }, [enabled]);
    // Auto-start if enabled
    (0, react_1.useEffect)(function () {
        if (settings.autoStart && hasCamera && !isScanning) {
            startScanning();
        }
    }, [settings.autoStart, hasCamera]);
    var initializeQRReader = function () {
        try {
            codeReaderRef.current = new library_1.BrowserMultiFormatReader();
            // Configure reader - ZXing library type definitions don't match actual API
            // These features are library-specific and handled internally
            // The reader will automatically process results through decode methods
        }
        catch (error) {
            console.error('Failed to initialize QR reader:', error);
            sonner_1.toast.error('Failed to initialize QR scanner');
        }
    };
    var checkCameraAvailability = function () { return __awaiter(_this, void 0, void 0, function () {
        var devices, videoDevices, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, navigator.mediaDevices.enumerateDevices()];
                case 1:
                    devices = _a.sent();
                    videoDevices = devices.filter(function (device) { return device.kind === 'videoinput'; });
                    setCameras(videoDevices);
                    setHasCamera(videoDevices.length > 0);
                    if (videoDevices.length > 0 && !selectedCamera) {
                        setSelectedCamera(videoDevices[0].deviceId);
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    console.error('Failed to check camera availability:', error_1);
                    setHasCamera(false);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var startScanning = function () { return __awaiter(_this, void 0, void 0, function () {
        var constraints, stream, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!codeReaderRef.current || !selectedCamera) {
                        sonner_1.toast.error('No camera selected or scanner not initialized');
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    setIsScanning(true);
                    constraints = {
                        video: {
                            deviceId: selectedCamera,
                            width: settings.maxResolutions ? { ideal: 1920 } : { ideal: 640 },
                            height: settings.maxResolutions ? { ideal: 1080 } : { ideal: 480 },
                            facingMode: 'environment',
                        },
                        audio: false,
                    };
                    return [4 /*yield*/, navigator.mediaDevices.getUserMedia(constraints)];
                case 2:
                    stream = _a.sent();
                    streamRef.current = stream;
                    if (!videoRef.current) return [3 /*break*/, 4];
                    videoRef.current.srcObject = stream;
                    return [4 /*yield*/, videoRef.current.play()];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    // Start continuous scanning
                    if (settings.continuous) {
                        startContinuousScanning();
                    }
                    else {
                        // Single scan mode
                        codeReaderRef.current.decodeOnceFromVideoDevice(selectedCamera, 'video')
                            .then(handleQRResult)
                            .catch(handleQRScanError);
                    }
                    sonner_1.toast.success('Camera started successfully');
                    return [3 /*break*/, 6];
                case 5:
                    error_2 = _a.sent();
                    console.error('Failed to start scanning:', error_2);
                    handleQRScanError(error_2);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var stopScanning = function () {
        try {
            setIsScanning(false);
            // Stop video stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(function (track) { return track.stop(); });
                streamRef.current = null;
            }
            // Clear video
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            // Clear scan timeout
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
                scanTimeoutRef.current = null;
            }
            sonner_1.toast.info('Camera stopped');
        }
        catch (error) {
            console.error('Failed to stop scanning:', error);
        }
    };
    var startContinuousScanning = function () {
        if (!codeReaderRef.current || !isScanning)
            return;
        var scan = function () { return __awaiter(_this, void 0, void 0, function () {
            var now, result, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!isScanning)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        now = Date.now();
                        if (now - lastScanTimeRef.current < settings.scanDelay) {
                            scanTimeoutRef.current = setTimeout(scan, 100);
                            return [2 /*return*/];
                        }
                        if (!(videoRef.current && codeReaderRef.current)) return [3 /*break*/, 3];
                        return [4 /*yield*/, codeReaderRef.current.decodeOnceFromVideoDevice(selectedCamera, 'video')];
                    case 2:
                        result = _a.sent();
                        if (result) {
                            handleQRResult(result);
                        }
                        _a.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_3 = _a.sent();
                        return [3 /*break*/, 5];
                    case 5:
                        // Schedule next scan
                        if (settings.continuous && isScanning) {
                            scanTimeoutRef.current = setTimeout(scan, 100);
                        }
                        return [2 /*return*/];
                }
            });
        }); };
        scan();
    };
    var handleQRResult = function (result) {
        var _a;
        try {
            var now = Date.now();
            lastScanTimeRef.current = now;
            var scanResult = {
                text: result.getText(),
                format: result.getBarcodeFormat().toString(),
                timestamp: new Date(),
                raw: result.getRawBytes().toString(),
            };
            setLastResult(scanResult);
            // Update statistics
            var scanTime_1 = now - (((_a = statistics.lastScanTime) === null || _a === void 0 ? void 0 : _a.getTime()) || now);
            setStatistics(function (prev) { return ({
                totalScans: prev.totalScans + 1,
                successfulScans: prev.successfulScans + 1,
                failedScans: prev.failedScans,
                averageScanTime: (prev.averageScanTime * prev.totalScans + scanTime_1) / (prev.totalScans + 1),
                lastScanTime: new Date(),
            }); });
            // Provide feedback
            if (settings.beepOnScan) {
                playBeep();
            }
            if (settings.vibrateOnScan && 'vibrate' in navigator) {
                navigator.vibrate(200);
            }
            // Call success callback
            onScanSuccess === null || onScanSuccess === void 0 ? void 0 : onScanSuccess(scanResult);
            // Show success toast
            sonner_1.toast.success("QR Code scanned: ".concat(scanResult.text));
            // Stop scanning if not in continuous mode
            if (!settings.continuous) {
                stopScanning();
            }
        }
        catch (error) {
            console.error('Error handling QR result:', error);
            handleQRScanError(error);
        }
    };
    var handleQRScanError = function (error) {
        console.error('QR scan error:', error);
        setStatistics(function (prev) { return (__assign(__assign({}, prev), { totalScans: prev.totalScans + 1, failedScans: prev.failedScans + 1 })); });
        var errorMessage = (error === null || error === void 0 ? void 0 : error.message) || 'Failed to scan QR code';
        onScanError === null || onScanError === void 0 ? void 0 : onScanError(errorMessage);
        // Don't show error toast for continuous scanning errors
        if (!settings.continuous) {
            sonner_1.toast.error(errorMessage);
        }
    };
    var playBeep = function () {
        try {
            // Create audio context for beep
            var audioContext = new (window.AudioContext || window.webkitAudioContext)();
            var oscillator = audioContext.createOscillator();
            var gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 1000; // 1kHz beep
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        }
        catch (error) {
            console.error('Failed to play beep:', error);
        }
    };
    var toggleTorch = function () { return __awaiter(_this, void 0, void 0, function () {
        var track, capabilities, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    if (!streamRef.current) return [3 /*break*/, 3];
                    track = streamRef.current.getVideoTracks()[0];
                    if (!track) return [3 /*break*/, 3];
                    capabilities = track.getCapabilities();
                    if (!capabilities.torch) return [3 /*break*/, 2];
                    return [4 /*yield*/, track.applyConstraints({
                            advanced: [{ torch: !settings.torchEnabled }]
                        })];
                case 1:
                    _a.sent();
                    setSettings(function (prev) { return (__assign(__assign({}, prev), { torchEnabled: !prev.torchEnabled })); });
                    return [3 /*break*/, 3];
                case 2:
                    sonner_1.toast.error('Torch not supported on this device');
                    _a.label = 3;
                case 3: return [3 /*break*/, 5];
                case 4:
                    error_4 = _a.sent();
                    console.error('Failed to toggle torch:', error_4);
                    sonner_1.toast.error('Failed to toggle flashlight');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var cleanup = function () {
        stopScanning();
        if (codeReaderRef.current) {
            // ZXing library doesn't have removeEventListener in types, but reset handles cleanup
            codeReaderRef.current.reset();
        }
    };
    var resetStatistics = function () {
        setStatistics({
            totalScans: 0,
            successfulScans: 0,
            failedScans: 0,
            averageScanTime: 0,
            lastScanTime: null,
        });
        setLastResult(null);
    };
    var switchCamera = function (deviceId) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (isScanning) {
                stopScanning();
                setSelectedCamera(deviceId);
                setTimeout(function () { return startScanning(); }, 500);
            }
            else {
                setSelectedCamera(deviceId);
            }
            return [2 /*return*/];
        });
    }); };
    return (<div className={"space-y-6 ".concat(className)}>
      <card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle className="flex items-center">
            <lucide_react_1.QrCode className="h-5 w-5 mr-2"/>
            QR Code Scanner
          </card_1.CardTitle>
          <card_1.CardDescription>
            Scan QR codes and barcodes using your device camera
          </card_1.CardDescription>
        </card_1.CardHeader>
        <card_1.CardContent className="space-y-4">
          {/* Camera Selection */}
          {cameras.length > 1 && (<div className="flex items-center space-x-4">
              <label_1.Label htmlFor="camera-select">Camera:</label_1.Label>
              <select_1.Select value={selectedCamera} onValueChange={switchCamera}>
                <select_1.SelectTrigger className="w-full max-w-xs">
                  <select_1.SelectValue placeholder="Select camera"/>
                </select_1.SelectTrigger>
                <select_1.SelectContent>
                  {cameras.map(function (camera) { return (<select_1.SelectItem key={camera.deviceId} value={camera.deviceId}>
                      <div className="flex items-center">
                        <lucide_react_1.Camera className="h-4 w-4 mr-2"/>
                        {camera.label || "Camera ".concat(camera.deviceId.slice(0, 8))}
                      </div>
                    </select_1.SelectItem>); })}
                </select_1.SelectContent>
              </select_1.Select>
            </div>)}

          {/* Video Preview */}
          <div className="relative">
            <video ref={videoRef} className="w-full h-64 bg-black rounded-lg object-cover" playsInline muted/>

            {/* Scanner Overlay */}
            {isScanning && settings.showOverlay && (<div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-4 border-2 border-green-500 rounded-lg">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-1 bg-green-500 animate-pulse"></div>
                </div>
              </div>)}

            {/* Status Indicator */}
            <div className="absolute top-2 right-2">
              <badge_1.Badge variant={isScanning ? "default" : "secondary"}>
                {isScanning ? "Scanning" : "Ready"}
              </badge_1.Badge>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex justify-center space-x-4">
            <button_1.Button onClick={isScanning ? stopScanning : startScanning} disabled={!hasCamera || !selectedCamera} size="lg">
              {isScanning ? (<>
                  <lucide_react_1.CameraOff className="h-4 w-4 mr-2"/>
                  Stop Scanning
                </>) : (<>
                  <lucide_react_1.Camera className="h-4 w-4 mr-2"/>
                  Start Scanning
                </>)}
            </button_1.Button>

            {hasCamera && (<button_1.Button variant="outline" onClick={toggleTorch} disabled={!streamRef.current}>
                <lucide_react_1.Zap className="h-4 w-4 mr-2"/>
                {settings.torchEnabled ? "Torch Off" : "Torch On"}
              </button_1.Button>)}
          </div>

          {!hasCamera && (<div className="text-center py-8">
              <lucide_react_1.CameraOff className="h-12 w-12 mx-auto text-gray-400 mb-4"/>
              <p className="text-gray-600">No camera detected</p>
              <p className="text-sm text-gray-500">
                Please ensure you have a camera connected and have granted camera permissions
              </p>
            </div>)}

          {/* Last Scan Result */}
          {lastResult && (<card_1.Card>
              <card_1.CardHeader>
                <card_1.CardTitle className="flex items-center text-sm">
                  <lucide_react_1.CheckCircle className="h-4 w-4 mr-2 text-green-500"/>
                  Last Scan Result
                </card_1.CardTitle>
              </card_1.CardHeader>
              <card_1.CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Content:</span>
                    <span className="font-mono text-sm">{lastResult.text}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Format:</span>
                    <badge_1.Badge variant="outline">{lastResult.format}</badge_1.Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Timestamp:</span>
                    <span className="text-sm">{lastResult.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              </card_1.CardContent>
            </card_1.Card>)}
        </card_1.CardContent>
      </card_1.Card>

      {/* Settings Panel */}
      {showSettings && (<card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle className="flex items-center">
              <lucide_react_1.Settings className="h-5 w-5 mr-2"/>
              Scanner Settings
            </card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <label_1.Label htmlFor="auto-start">Auto-start</label_1.Label>
              <switch_1.Switch id="auto-start" checked={settings.autoStart} onCheckedChange={function (checked) { return setSettings(function (prev) { return (__assign(__assign({}, prev), { autoStart: checked })); }); }}/>
            </div>

            <div className="flex items-center justify-between">
              <label_1.Label htmlFor="continuous">Continuous Scanning</label_1.Label>
              <switch_1.Switch id="continuous" checked={settings.continuous} onCheckedChange={function (checked) {
                setSettings(function (prev) { return (__assign(__assign({}, prev), { continuous: checked })); });
                if (checked && isScanning) {
                    startContinuousScanning();
                }
            }}/>
            </div>

            <div className="flex items-center justify-between">
              <label_1.Label htmlFor="beep-on-scan">Beep on Scan</label_1.Label>
              <switch_1.Switch id="beep-on-scan" checked={settings.beepOnScan} onCheckedChange={function (checked) { return setSettings(function (prev) { return (__assign(__assign({}, prev), { beepOnScan: checked })); }); }}/>
            </div>

            <div className="flex items-center justify-between">
              <label_1.Label htmlFor="vibrate-on-scan">Vibrate on Scan</label_1.Label>
              <switch_1.Switch id="vibrate-on-scan" checked={settings.vibrateOnScan} onCheckedChange={function (checked) { return setSettings(function (prev) { return (__assign(__assign({}, prev), { vibrateOnScan: checked })); }); }}/>
            </div>

            <div className="flex items-center justify-between">
              <label_1.Label htmlFor="show-overlay">Show Scan Overlay</label_1.Label>
              <switch_1.Switch id="show-overlay" checked={settings.showOverlay} onCheckedChange={function (checked) { return setSettings(function (prev) { return (__assign(__assign({}, prev), { showOverlay: checked })); }); }}/>
            </div>

            <div className="flex items-center justify-between">
              <label_1.Label htmlFor="max-resolution">Maximum Resolution</label_1.Label>
              <switch_1.Switch id="max-resolution" checked={settings.maxResolutions} onCheckedChange={function (checked) { return setSettings(function (prev) { return (__assign(__assign({}, prev), { maxResolutions: checked })); }); }}/>
            </div>

            <div>
              <label_1.Label htmlFor="scan-delay">Scan Delay (ms)</label_1.Label>
              <input_1.Input id="scan-delay" type="number" value={settings.scanDelay} onChange={function (e) { return setSettings(function (prev) { return (__assign(__assign({}, prev), { scanDelay: parseInt(e.target.value) || 1000 })); }); }} min="100" max="5000" step="100"/>
            </div>
          </card_1.CardContent>
        </card_1.Card>)}

      {/* Statistics */}
      <card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <lucide_react_1.Activity className="h-4 w-4 mr-2"/>
              Scan Statistics
            </span>
            <button_1.Button variant="outline" size="sm" onClick={resetStatistics}>
              <lucide_react_1.RefreshCw className="h-4 w-4 mr-2"/>
              Reset
            </button_1.Button>
          </card_1.CardTitle>
        </card_1.CardHeader>
        <card_1.CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{statistics.totalScans}</div>
              <p className="text-sm text-gray-600">Total Scans</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{statistics.successfulScans}</div>
              <p className="text-sm text-gray-600">Successful</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{statistics.failedScans}</div>
              <p className="text-sm text-gray-600">Failed</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{statistics.averageScanTime.toFixed(0)}ms</div>
              <p className="text-sm text-gray-600">Avg Time</p>
            </div>
          </div>
        </card_1.CardContent>
      </card_1.Card>
    </div>);
}

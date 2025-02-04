"use strict";
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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
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
exports.Html5QrcodeScanner = void 0;
var core_1 = require("./core");
var html5_qrcode_1 = require("./html5-qrcode");
var strings_1 = require("./strings");
var storage_1 = require("./storage");
var ui_1 = require("./ui");
var permissions_1 = require("./camera/permissions");
var scan_type_selector_1 = require("./ui/scanner/scan-type-selector");
var base_1 = require("./ui/scanner/base");
var camera_selection_ui_1 = require("./ui/scanner/camera-selection-ui");
var Html5QrcodeScannerStatus;
(function (Html5QrcodeScannerStatus) {
    Html5QrcodeScannerStatus[Html5QrcodeScannerStatus["STATUS_DEFAULT"] = 0] = "STATUS_DEFAULT";
    Html5QrcodeScannerStatus[Html5QrcodeScannerStatus["STATUS_SUCCESS"] = 1] = "STATUS_SUCCESS";
    Html5QrcodeScannerStatus[Html5QrcodeScannerStatus["STATUS_WARNING"] = 2] = "STATUS_WARNING";
    Html5QrcodeScannerStatus[Html5QrcodeScannerStatus["STATUS_REQUESTING_PERMISSION"] = 3] = "STATUS_REQUESTING_PERMISSION";
})(Html5QrcodeScannerStatus || (Html5QrcodeScannerStatus = {}));
function toHtml5QrcodeCameraScanConfig(config) {
    return {
        fps: config.fps,
        qrbox: config.qrbox,
        aspectRatio: config.aspectRatio,
        disableFlip: config.disableFlip,
        videoConstraints: config.videoConstraints
    };
}
function toHtml5QrcodeFullConfig(config, verbose) {
    return {
        formatsToSupport: config.formatsToSupport,
        useBarCodeDetectorIfSupported: config.useBarCodeDetectorIfSupported,
        experimentalFeatures: config.experimentalFeatures,
        verbose: verbose
    };
}
var Html5QrcodeScanner = (function () {
    function Html5QrcodeScanner(elementId, config, verbose) {
        this.lastMatchFound = null;
        this.cameraScanImage = null;
        this.fileScanImage = null;
        this.fileSelectionUi = null;
        this.isTransitioning = false;
        this.elementId = elementId;
        this.config = this.createConfig(config);
        this.verbose = verbose === true;
        if (!document.getElementById(elementId)) {
            throw "HTML Element with id=".concat(elementId, " not found");
        }
        this.scanTypeSelector = new scan_type_selector_1.ScanTypeSelector(this.config.supportedScanTypes);
        this.currentScanType = this.scanTypeSelector.getDefaultScanType();
        this.sectionSwapAllowed = true;
        this.logger = new core_1.BaseLoggger(this.verbose);
        this.persistedDataManager = new storage_1.PersistedDataManager();
        if (config.rememberLastUsedCamera !== true) {
            this.persistedDataManager.reset();
        }
    }
    Html5QrcodeScanner.prototype.render = function (qrCodeSuccessCallback, qrCodeErrorCallback) {
        var _this = this;
        this.lastMatchFound = null;
        this.qrCodeSuccessCallback = function (decodedText, result) {
            if (qrCodeSuccessCallback) {
                qrCodeSuccessCallback(decodedText, result);
            }
            else {
                if (_this.lastMatchFound === decodedText) {
                    return;
                }
                _this.lastMatchFound = decodedText;
                _this.setHeaderMessage(strings_1.Html5QrcodeScannerStrings.lastMatch(decodedText), Html5QrcodeScannerStatus.STATUS_SUCCESS);
            }
        };
        this.qrCodeErrorCallback = function (errorMessage, error) {
            if (qrCodeErrorCallback) {
                qrCodeErrorCallback(errorMessage, error);
            }
        };
        var container = document.getElementById(this.elementId);
        if (!container) {
            throw "HTML Element with id=".concat(this.elementId, " not found");
        }
        container.innerHTML = "";
        this.createBasicLayout(container);
        this.html5Qrcode = new html5_qrcode_1.Html5Qrcode(this.getScanRegionId(), toHtml5QrcodeFullConfig(this.config, this.verbose));
        this.startCameraAutomatically();
    };
    Html5QrcodeScanner.prototype.getCameraFacingMode = function (cameraId) {
        return __awaiter(this, void 0, void 0, function () {
            var stream, track, settings, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, navigator.mediaDevices.getUserMedia({ video: { deviceId: cameraId } })];
                    case 1:
                        stream = _a.sent();
                        track = stream.getVideoTracks()[0];
                        settings = track.getSettings();
                        stream.getTracks().forEach(function (track) { return track.stop(); });
                        return [2, settings.facingMode === 'environment' || settings.facingMode === 'user'
                                ? settings.facingMode
                                : undefined];
                    case 2:
                        error_1 = _a.sent();
                        console.error("Error getting camera facing mode:", error_1);
                        return [2, undefined];
                    case 3: return [2];
                }
            });
        });
    };
    Html5QrcodeScanner.prototype.startCameraAutomatically = function () {
        var scpCameraScanRegion = document.getElementById(this.getDashboardSectionCameraScanRegionId());
        var requestPermissionContainer = document.createElement("div");
        this.createCameraListUi(scpCameraScanRegion, requestPermissionContainer);
    };
    Html5QrcodeScanner.prototype.pause = function (shouldPauseVideo) {
        if ((0, core_1.isNullOrUndefined)(shouldPauseVideo) || shouldPauseVideo !== true) {
            shouldPauseVideo = false;
        }
        this.getHtml5QrcodeOrFail().pause(shouldPauseVideo);
    };
    Html5QrcodeScanner.prototype.resume = function () {
        this.getHtml5QrcodeOrFail().resume();
    };
    Html5QrcodeScanner.prototype.getState = function () {
        return this.getHtml5QrcodeOrFail().getState();
    };
    Html5QrcodeScanner.prototype.clear = function () {
        var _this = this;
        var emptyHtmlContainer = function () {
            var mainContainer = document.getElementById(_this.elementId);
            if (mainContainer) {
                mainContainer.innerHTML = "";
                _this.resetBasicLayout(mainContainer);
            }
        };
        if (this.html5Qrcode) {
            return new Promise(function (resolve, reject) {
                if (!_this.html5Qrcode) {
                    resolve();
                    return;
                }
                if (_this.html5Qrcode.isScanning) {
                    _this.html5Qrcode.stop().then(function (_) {
                        if (!_this.html5Qrcode) {
                            resolve();
                            return;
                        }
                        _this.html5Qrcode.clear();
                        emptyHtmlContainer();
                        resolve();
                    }).catch(function (error) {
                        if (_this.verbose) {
                            _this.logger.logError("Unable to stop qrcode scanner", error);
                        }
                        reject(error);
                    });
                }
                else {
                    _this.html5Qrcode.clear();
                    emptyHtmlContainer();
                    resolve();
                }
            });
        }
        return Promise.resolve();
    };
    Html5QrcodeScanner.prototype.getRunningTrackCapabilities = function () {
        return this.getHtml5QrcodeOrFail().getRunningTrackCapabilities();
    };
    Html5QrcodeScanner.prototype.getRunningTrackSettings = function () {
        return this.getHtml5QrcodeOrFail().getRunningTrackSettings();
    };
    Html5QrcodeScanner.prototype.applyVideoConstraints = function (videoConstaints) {
        return this.getHtml5QrcodeOrFail().applyVideoConstraints(videoConstaints);
    };
    Html5QrcodeScanner.prototype.getHtml5QrcodeOrFail = function () {
        if (!this.html5Qrcode) {
            throw "Code scanner not initialized.";
        }
        return this.html5Qrcode;
    };
    Html5QrcodeScanner.prototype.createConfig = function (config) {
        if (config) {
            if (!config.fps) {
                config.fps = core_1.Html5QrcodeConstants.SCAN_DEFAULT_FPS;
            }
            config.supportedScanTypes = [core_1.Html5QrcodeScanType.SCAN_TYPE_CAMERA];
            if (config.rememberLastUsedCamera !== (!core_1.Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED)) {
                config.rememberLastUsedCamera
                    = core_1.Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED;
            }
            return config;
        }
        return {
            fps: core_1.Html5QrcodeConstants.SCAN_DEFAULT_FPS,
            rememberLastUsedCamera: core_1.Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED,
            supportedScanTypes: [core_1.Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        };
    };
    Html5QrcodeScanner.prototype.createBasicLayout = function (parent) {
        parent.style.position = "relative";
        parent.style.padding = "0px";
        parent.style.border = "1px solid silver";
        this.createHeader(parent);
        var qrCodeScanRegion = document.createElement("div");
        var scanRegionId = this.getScanRegionId();
        qrCodeScanRegion.id = scanRegionId;
        qrCodeScanRegion.style.width = "100%";
        qrCodeScanRegion.style.minHeight = "100px";
        qrCodeScanRegion.style.textAlign = "center";
        parent.appendChild(qrCodeScanRegion);
        if (scan_type_selector_1.ScanTypeSelector.isCameraScanType(this.currentScanType)) {
            this.insertCameraScanImageToScanRegion();
        }
        var qrCodeDashboard = document.createElement("div");
        var dashboardId = this.getDashboardId();
        qrCodeDashboard.id = dashboardId;
        qrCodeDashboard.style.width = "100%";
        parent.appendChild(qrCodeDashboard);
        this.setupInitialDashboard(qrCodeDashboard);
    };
    Html5QrcodeScanner.prototype.resetBasicLayout = function (mainContainer) {
        mainContainer.style.border = "none";
    };
    Html5QrcodeScanner.prototype.setupInitialDashboard = function (dashboard) {
        this.createSection(dashboard);
        this.createSectionControlPanel();
    };
    Html5QrcodeScanner.prototype.createHeader = function (dashboard) {
        var header = document.createElement("div");
        header.style.textAlign = "left";
        header.style.margin = "0px";
        dashboard.appendChild(header);
        var libraryInfo = new ui_1.LibraryInfoContainer();
        libraryInfo.renderInto(header);
        var headerMessageContainer = document.createElement("div");
        headerMessageContainer.id = this.getHeaderMessageContainerId();
        headerMessageContainer.style.display = "none";
        headerMessageContainer.style.textAlign = "center";
        headerMessageContainer.style.fontSize = "14px";
        headerMessageContainer.style.padding = "2px 10px";
        headerMessageContainer.style.margin = "4px";
        headerMessageContainer.style.borderTop = "1px solid #f6f6f6";
        header.appendChild(headerMessageContainer);
    };
    Html5QrcodeScanner.prototype.createSection = function (dashboard) {
        var section = document.createElement("div");
        section.id = this.getDashboardSectionId();
        section.style.width = "100%";
        section.style.padding = "10px 0px 10px 0px";
        section.style.textAlign = "left";
        dashboard.appendChild(section);
    };
    Html5QrcodeScanner.prototype.createCameraListUi = function (scpCameraScanRegion, requestPermissionContainer, requestPermissionButton) {
        if (this.isTransitioning) {
            return;
        }
        var $this = this;
        $this.showHideScanTypeSwapLink(false);
        $this.setHeaderMessage(strings_1.Html5QrcodeScannerStrings.cameraPermissionRequesting());
        scpCameraScanRegion.innerHTML = '';
        html5_qrcode_1.Html5Qrcode.getCameras().then(function (cameras) {
            $this.persistedDataManager.setHasPermission(true);
            $this.showHideScanTypeSwapLink(true);
            $this.resetHeaderMessage();
            if (cameras && cameras.length > 0) {
                if (requestPermissionContainer && requestPermissionContainer.parentElement) {
                    requestPermissionContainer.parentElement.removeChild(requestPermissionContainer);
                }
                if (!document.getElementById(base_1.PublicUiElementIdAndClasses.CAMERA_SELECTION_SELECT_ID)) {
                    $this.renderCameraSelection(cameras);
                }
            }
            else {
                $this.setHeaderMessage(strings_1.Html5QrcodeScannerStrings.noCameraFound(), Html5QrcodeScannerStatus.STATUS_WARNING);
                if (!requestPermissionButton) {
                    $this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
                }
            }
        }).catch(function (error) {
            $this.persistedDataManager.setHasPermission(false);
            if (requestPermissionButton) {
                requestPermissionButton.disabled = false;
            }
            else {
                $this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
            }
            $this.setHeaderMessage(error, Html5QrcodeScannerStatus.STATUS_WARNING);
            $this.showHideScanTypeSwapLink(true);
        });
    };
    Html5QrcodeScanner.prototype.createPermissionButton = function (scpCameraScanRegion, requestPermissionContainer) {
        var $this = this;
        var requestPermissionButton = base_1.BaseUiElementFactory
            .createElement("button", this.getCameraPermissionButtonId());
        requestPermissionButton.innerText
            = strings_1.Html5QrcodeScannerStrings.cameraPermissionTitle();
        requestPermissionButton.addEventListener("click", function () {
            requestPermissionButton.disabled = true;
            $this.createCameraListUi(scpCameraScanRegion, requestPermissionContainer, requestPermissionButton);
        });
        requestPermissionContainer.appendChild(requestPermissionButton);
    };
    Html5QrcodeScanner.prototype.createPermissionsUi = function (scpCameraScanRegion, requestPermissionContainer) {
        var $this = this;
        if (!requestPermissionContainer.parentElement) {
            scpCameraScanRegion.appendChild(requestPermissionContainer);
        }
        if (scan_type_selector_1.ScanTypeSelector.isCameraScanType(this.currentScanType)
            && this.persistedDataManager.hasCameraPermissions()) {
            permissions_1.CameraPermissions.hasPermissions().then(function (hasPermissions) {
                if (hasPermissions) {
                    $this.createCameraListUi(scpCameraScanRegion, requestPermissionContainer);
                }
                else {
                    $this.persistedDataManager.setHasPermission(false);
                    $this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
                }
            }).catch(function (_) {
                $this.persistedDataManager.setHasPermission(false);
                $this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
            });
            return;
        }
        this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
    };
    Html5QrcodeScanner.prototype.createSectionControlPanel = function () {
        var section = document.getElementById(this.getDashboardSectionId());
        var existingControlPanel = section.querySelector('div');
        if (existingControlPanel) {
            section.removeChild(existingControlPanel);
        }
        var sectionControlPanel = document.createElement("div");
        section.appendChild(sectionControlPanel);
        var scpCameraScanRegion = document.createElement("div");
        scpCameraScanRegion.id = this.getDashboardSectionCameraScanRegionId();
        scpCameraScanRegion.style.display = "block";
        sectionControlPanel.appendChild(scpCameraScanRegion);
        var requestPermissionContainer = document.createElement("div");
        requestPermissionContainer.style.textAlign = "center";
        requestPermissionContainer.id = "".concat(this.elementId, "__permission_container");
        this.createPermissionsUi(scpCameraScanRegion, requestPermissionContainer);
    };
    Html5QrcodeScanner.prototype.startCameraScanning = function (cameraId) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.html5Qrcode) {
                            throw "html5Qrcode not defined";
                        }
                        if (this.isTransitioning) {
                            console.log("Camera transition in progress, please wait");
                            return [2];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, 8, 9]);
                        this.isTransitioning = true;
                        if (!this.html5Qrcode.isScanning) return [3, 4];
                        return [4, this.html5Qrcode.stop()];
                    case 2:
                        _a.sent();
                        return [4, new Promise(function (resolve) { return setTimeout(resolve, 300); })];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [4, new Promise(function (resolve) { return setTimeout(resolve, 300); })];
                    case 5:
                        _a.sent();
                        return [4, this.html5Qrcode.start(cameraId, {
                                fps: this.config.fps || 10,
                                qrbox: this.config.qrbox,
                                aspectRatio: 1.0,
                                disableFlip: false
                            }, this.qrCodeSuccessCallback, this.qrCodeErrorCallback)];
                    case 6:
                        _a.sent();
                        return [3, 9];
                    case 7:
                        error_2 = _a.sent();
                        console.error("Camera error:", error_2);
                        this.setHeaderMessage("Error accessing camera. Please try again.", Html5QrcodeScannerStatus.STATUS_WARNING);
                        return [3, 9];
                    case 8:
                        this.isTransitioning = false;
                        return [7];
                    case 9: return [2];
                }
            });
        });
    };
    Html5QrcodeScanner.prototype.renderCameraSelection = function (cameras) {
        return __awaiter(this, void 0, void 0, function () {
            var scpCameraScanRegion, rearCamera, _i, cameras_1, camera, facingMode, defaultCamera, cameraSelectUi, error_3, cameraSelectElement, newElement;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        scpCameraScanRegion = document.getElementById(this.getDashboardSectionCameraScanRegionId());
                        scpCameraScanRegion.innerHTML = '';
                        scpCameraScanRegion.style.textAlign = "center";
                        _i = 0, cameras_1 = cameras;
                        _a.label = 1;
                    case 1:
                        if (!(_i < cameras_1.length)) return [3, 4];
                        camera = cameras_1[_i];
                        return [4, this.getCameraFacingMode(camera.id)];
                    case 2:
                        facingMode = _a.sent();
                        if (facingMode === 'environment') {
                            rearCamera = camera;
                            return [3, 4];
                        }
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3, 1];
                    case 4:
                        defaultCamera = rearCamera || cameras[0];
                        cameraSelectUi = null;
                        try {
                            cameraSelectUi = camera_selection_ui_1.CameraSelectionUi.create(scpCameraScanRegion, cameras);
                        }
                        catch (error) {
                            console.error("Error creating camera selection UI:", error);
                            return [2];
                        }
                        if (!(defaultCamera && cameraSelectUi)) return [3, 8];
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 8]);
                        cameraSelectUi.setValue(defaultCamera.id);
                        return [4, this.startCameraScanning(defaultCamera.id)];
                    case 6:
                        _a.sent();
                        return [3, 8];
                    case 7:
                        error_3 = _a.sent();
                        console.error("Error starting camera:", error_3);
                        return [3, 8];
                    case 8:
                        cameraSelectElement = document.getElementById(base_1.PublicUiElementIdAndClasses.CAMERA_SELECTION_SELECT_ID);
                        if (cameraSelectElement) {
                            newElement = cameraSelectElement.cloneNode(true);
                            if (cameraSelectElement.parentNode) {
                                cameraSelectElement.parentNode.replaceChild(newElement, cameraSelectElement);
                            }
                            newElement.addEventListener('change', function (event) {
                                var selectedCameraId = event.target.value;
                                _this.startCameraScanning(selectedCameraId);
                            });
                        }
                        return [2];
                }
            });
        });
    };
    Html5QrcodeScanner.prototype.startCameraScanIfPermissionExistsOnSwap = function () {
        var _this = this;
        var $this = this;
        if (this.persistedDataManager.hasCameraPermissions()) {
            permissions_1.CameraPermissions.hasPermissions().then(function (hasPermissions) {
                if (hasPermissions) {
                    var permissionButton = document.getElementById($this.getCameraPermissionButtonId());
                    if (!permissionButton) {
                        _this.logger.logError("Permission button not found, fail;");
                        throw "Permission button not found";
                    }
                    permissionButton.click();
                }
                else {
                    $this.persistedDataManager.setHasPermission(false);
                }
            }).catch(function (_) {
                $this.persistedDataManager.setHasPermission(false);
            });
            return;
        }
    };
    Html5QrcodeScanner.prototype.resetHeaderMessage = function () {
        var messageDiv = document.getElementById(this.getHeaderMessageContainerId());
        messageDiv.style.display = "none";
    };
    Html5QrcodeScanner.prototype.setHeaderMessage = function (messageText, scannerStatus) {
        if (!scannerStatus) {
            scannerStatus = Html5QrcodeScannerStatus.STATUS_DEFAULT;
        }
        var messageDiv = this.getHeaderMessageDiv();
        messageDiv.innerText = messageText;
        messageDiv.style.display = "block";
        switch (scannerStatus) {
            case Html5QrcodeScannerStatus.STATUS_SUCCESS:
                messageDiv.style.background = "rgba(106, 175, 80, 0.26)";
                messageDiv.style.color = "#477735";
                break;
            case Html5QrcodeScannerStatus.STATUS_WARNING:
                messageDiv.style.background = "rgba(203, 36, 49, 0.14)";
                messageDiv.style.color = "#cb2431";
                break;
            case Html5QrcodeScannerStatus.STATUS_DEFAULT:
            default:
                messageDiv.style.background = "rgba(0, 0, 0, 0)";
                messageDiv.style.color = "rgb(17, 17, 17)";
                break;
        }
    };
    Html5QrcodeScanner.prototype.showHideScanTypeSwapLink = function (shouldDisplay) {
        if (this.scanTypeSelector.hasMoreThanOneScanType()) {
            if (shouldDisplay !== true) {
                shouldDisplay = false;
            }
            this.sectionSwapAllowed = shouldDisplay;
            this.getDashboardSectionSwapLink().style.display
                = shouldDisplay ? "inline-block" : "none";
        }
    };
    Html5QrcodeScanner.prototype.insertCameraScanImageToScanRegion = function () {
        var qrCodeScanRegion = document.getElementById(this.getScanRegionId());
        qrCodeScanRegion.innerHTML = "<br>";
        var svgHtml = "<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n            <path d=\"M32 47.5C40.5604 47.5 47.5 40.5604 47.5 32C47.5 23.4396 40.5604 16.5 32 16.5C23.4396 16.5 16.5 23.4396 16.5 32C16.5 40.5604 23.4396 47.5 32 47.5Z\" stroke=\"currentColor\" stroke-width=\"3\"/>\n            <path d=\"M32 39.5C36.6944 39.5 40.5 35.6944 40.5 31C40.5 26.3056 36.6944 22.5 32 22.5C27.3056 22.5 23.5 26.3056 23.5 31C23.5 35.6944 27.3056 39.5 32 39.5Z\" fill=\"currentColor\"/>\n        </svg>";
        qrCodeScanRegion.insertAdjacentHTML('beforeend', svgHtml);
    };
    Html5QrcodeScanner.prototype.clearScanRegion = function () {
        var qrCodeScanRegion = document.getElementById(this.getScanRegionId());
        qrCodeScanRegion.innerHTML = "";
    };
    Html5QrcodeScanner.prototype.getDashboardSectionId = function () {
        return "".concat(this.elementId, "__dashboard_section");
    };
    Html5QrcodeScanner.prototype.getDashboardSectionCameraScanRegionId = function () {
        return "".concat(this.elementId, "__dashboard_section_csr");
    };
    Html5QrcodeScanner.prototype.getDashboardSectionSwapLinkId = function () {
        return base_1.PublicUiElementIdAndClasses.SCAN_TYPE_CHANGE_ANCHOR_ID;
    };
    Html5QrcodeScanner.prototype.getScanRegionId = function () {
        return "".concat(this.elementId, "__scan_region");
    };
    Html5QrcodeScanner.prototype.getDashboardId = function () {
        return "".concat(this.elementId, "__dashboard");
    };
    Html5QrcodeScanner.prototype.getHeaderMessageContainerId = function () {
        return "".concat(this.elementId, "__header_message");
    };
    Html5QrcodeScanner.prototype.getCameraPermissionButtonId = function () {
        return base_1.PublicUiElementIdAndClasses.CAMERA_PERMISSION_BUTTON_ID;
    };
    Html5QrcodeScanner.prototype.getCameraScanRegion = function () {
        return document.getElementById(this.getDashboardSectionCameraScanRegionId());
    };
    Html5QrcodeScanner.prototype.getDashboardSectionSwapLink = function () {
        return document.getElementById(this.getDashboardSectionSwapLinkId());
    };
    Html5QrcodeScanner.prototype.getHeaderMessageDiv = function () {
        return document.getElementById(this.getHeaderMessageContainerId());
    };
    return Html5QrcodeScanner;
}());
exports.Html5QrcodeScanner = Html5QrcodeScanner;
//# sourceMappingURL=html5-qrcode-scanner.js.map
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
var image_assets_1 = require("./image-assets");
var storage_1 = require("./storage");
var ui_1 = require("./ui");
var permissions_1 = require("./camera/permissions");
var scan_type_selector_1 = require("./ui/scanner/scan-type-selector");
var file_selection_ui_1 = require("./ui/scanner/file-selection-ui");
var base_1 = require("./ui/scanner/base");
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
        this.qrCodeSuccessCallback
            = function (decodedText, result) {
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
        this.qrCodeErrorCallback =
            function (errorMessage, error) {
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
        this.startCameraScan();
    };
    Html5QrcodeScanner.prototype.startCameraScan = function () {
        var $this = this;
        html5_qrcode_1.Html5Qrcode.getCameras().then(function (cameras) {
            if (cameras && cameras.length > 0) {
                var cameraId = cameras[0].id;
                $this.html5Qrcode.start(cameraId, toHtml5QrcodeCameraScanConfig($this.config), $this.qrCodeSuccessCallback, $this.qrCodeErrorCallback).catch(function (error) {
                    console.error("Unable to start scanning: ", error);
                });
            }
            else {
                $this.setHeaderMessage(strings_1.Html5QrcodeScannerStrings.noCameraFound(), Html5QrcodeScannerStatus.STATUS_WARNING);
            }
        }).catch(function (error) {
            $this.setHeaderMessage(error, Html5QrcodeScannerStatus.STATUS_WARNING);
        });
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
            if (config.rememberLastUsedCamera !== (!core_1.Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED)) {
                config.rememberLastUsedCamera
                    = core_1.Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED;
            }
            config.supportedScanTypes = [core_1.Html5QrcodeScanType.SCAN_TYPE_CAMERA];
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
        var $this = this;
        $this.showHideScanTypeSwapLink(false);
        $this.setHeaderMessage(strings_1.Html5QrcodeScannerStrings.cameraPermissionRequesting());
        var createPermissionButtonIfNotExists = function () {
            if (!requestPermissionButton) {
                $this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
            }
        };
        html5_qrcode_1.Html5Qrcode.getCameras().then(function (cameras) {
            $this.persistedDataManager.setHasPermission(true);
            $this.showHideScanTypeSwapLink(true);
            $this.resetHeaderMessage();
            if (cameras && cameras.length > 0) {
                scpCameraScanRegion.removeChild(requestPermissionContainer);
                $this.renderCameraSelection(cameras);
            }
            else {
                $this.setHeaderMessage(strings_1.Html5QrcodeScannerStrings.noCameraFound(), Html5QrcodeScannerStatus.STATUS_WARNING);
                createPermissionButtonIfNotExists();
            }
        }).catch(function (error) {
            $this.persistedDataManager.setHasPermission(false);
            if (requestPermissionButton) {
                requestPermissionButton.disabled = false;
            }
            else {
                createPermissionButtonIfNotExists();
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
        if (scan_type_selector_1.ScanTypeSelector.isCameraScanType(this.currentScanType)) {
            permissions_1.CameraPermissions.hasPermissions().then(function (hasPermissions) {
                console.log(hasPermissions);
                if (hasPermissions) {
                    $this.createCameraListUi(scpCameraScanRegion, requestPermissionContainer);
                    $this.renderCameraSelection([]);
                }
                else {
                    $this.persistedDataManager.setHasPermission(false);
                    $this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
                    $this.renderCameraSelection([]);
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
        var sectionControlPanel = document.createElement("div");
        section.appendChild(sectionControlPanel);
        var scpCameraScanRegion = document.createElement("div");
        scpCameraScanRegion.id = this.getDashboardSectionCameraScanRegionId();
        scpCameraScanRegion.style.display = "block";
        sectionControlPanel.appendChild(scpCameraScanRegion);
        var requestPermissionContainer = document.createElement("div");
        requestPermissionContainer.style.textAlign = "center";
        scpCameraScanRegion.appendChild(requestPermissionContainer);
        this.createPermissionsUi(scpCameraScanRegion, requestPermissionContainer);
    };
    Html5QrcodeScanner.prototype.renderFileScanUi = function (parent) {
        var showOnRender = scan_type_selector_1.ScanTypeSelector.isFileScanType(this.currentScanType);
        var $this = this;
        var onFileSelected = function (file) {
            if (!$this.html5Qrcode) {
                throw "html5Qrcode not defined";
            }
            if (!scan_type_selector_1.ScanTypeSelector.isFileScanType($this.currentScanType)) {
                return;
            }
            $this.setHeaderMessage(strings_1.Html5QrcodeScannerStrings.loadingImage());
            $this.html5Qrcode.scanFileV2(file, true)
                .then(function (html5qrcodeResult) {
                $this.resetHeaderMessage();
                $this.qrCodeSuccessCallback(html5qrcodeResult.decodedText, html5qrcodeResult);
            })
                .catch(function (error) {
                $this.setHeaderMessage(error, Html5QrcodeScannerStatus.STATUS_WARNING);
                $this.qrCodeErrorCallback(error, core_1.Html5QrcodeErrorFactory.createFrom(error));
            });
        };
        this.fileSelectionUi = file_selection_ui_1.FileSelectionUi.create(parent, showOnRender, onFileSelected);
    };
    Html5QrcodeScanner.prototype.renderCameraSelection = function (cameras) {
        var _this = this;
        var $this = this;
        var scpCameraScanRegion = document.getElementById(this.getDashboardSectionCameraScanRegionId());
        scpCameraScanRegion.style.textAlign = "center";
        var rearCamera = cameras.find(function (camera) {
            return camera.label.toLowerCase().includes("back") ||
                camera.label.toLowerCase().includes("rear");
        });
        var cameraId = rearCamera ? rearCamera.id : cameras[0].id;
        $this.html5Qrcode.start(cameraId, toHtml5QrcodeCameraScanConfig($this.config), $this.qrCodeSuccessCallback, $this.qrCodeErrorCallback).catch(function (error) {
            console.error("Unable to start scanning: ", error);
        });
        var cameraSelector = document.createElement("select");
        cameras.forEach(function (camera) {
            var option = document.createElement("option");
            option.value = camera.id;
            option.text = camera.label;
            cameraSelector.appendChild(option);
        });
        cameraSelector.onchange = function (event) { return __awaiter(_this, void 0, void 0, function () {
            var target, selectedCameraId, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        if (!$this.html5Qrcode.isScanning) return [3, 2];
                        return [4, $this.html5Qrcode.stop()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        target = event.target;
                        if (!target) return [3, 4];
                        selectedCameraId = target.value;
                        return [4, $this.html5Qrcode.start(selectedCameraId, toHtml5QrcodeCameraScanConfig($this.config), $this.qrCodeSuccessCallback, $this.qrCodeErrorCallback)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [3, 6];
                    case 5:
                        error_1 = _a.sent();
                        console.error("Error switching cameras: ", error_1);
                        return [3, 6];
                    case 6: return [2];
                }
            });
        }); };
        scpCameraScanRegion.appendChild(cameraSelector);
    };
    Html5QrcodeScanner.prototype.createSectionSwap = function () {
        var $this = this;
        var TEXT_IF_CAMERA_SCAN_SELECTED = strings_1.Html5QrcodeScannerStrings.textIfCameraScanSelected();
        var TEXT_IF_FILE_SCAN_SELECTED = strings_1.Html5QrcodeScannerStrings.textIfFileScanSelected();
        var section = document.getElementById(this.getDashboardSectionId());
        var switchContainer = document.createElement("div");
        switchContainer.style.textAlign = "center";
        var switchScanTypeLink = base_1.BaseUiElementFactory.createElement("span", this.getDashboardSectionSwapLinkId());
        switchScanTypeLink.style.textDecoration = "underline";
        switchScanTypeLink.style.cursor = "pointer";
        switchScanTypeLink.innerText
            = scan_type_selector_1.ScanTypeSelector.isCameraScanType(this.currentScanType)
                ? TEXT_IF_CAMERA_SCAN_SELECTED : TEXT_IF_FILE_SCAN_SELECTED;
        switchScanTypeLink.addEventListener("click", function () {
            if (!$this.sectionSwapAllowed) {
                if ($this.verbose) {
                    $this.logger.logError("Section swap called when not allowed");
                }
                return;
            }
            $this.resetHeaderMessage();
            $this.fileSelectionUi.resetValue();
            $this.sectionSwapAllowed = false;
            if (scan_type_selector_1.ScanTypeSelector.isCameraScanType($this.currentScanType)) {
                $this.clearScanRegion();
                $this.getCameraScanRegion().style.display = "none";
                $this.fileSelectionUi.show();
                switchScanTypeLink.innerText = TEXT_IF_FILE_SCAN_SELECTED;
                $this.currentScanType = core_1.Html5QrcodeScanType.SCAN_TYPE_FILE;
            }
            else {
                $this.clearScanRegion();
                $this.getCameraScanRegion().style.display = "block";
                $this.fileSelectionUi.hide();
                switchScanTypeLink.innerText = TEXT_IF_CAMERA_SCAN_SELECTED;
                $this.currentScanType = core_1.Html5QrcodeScanType.SCAN_TYPE_CAMERA;
                $this.insertCameraScanImageToScanRegion();
                $this.startCameraScanIfPermissionExistsOnSwap();
            }
            $this.sectionSwapAllowed = true;
        });
        switchContainer.appendChild(switchScanTypeLink);
        section.appendChild(switchContainer);
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
        var $this = this;
        var qrCodeScanRegion = document.getElementById(this.getScanRegionId());
        if (this.cameraScanImage) {
            qrCodeScanRegion.innerHTML = "<br>";
            qrCodeScanRegion.appendChild(this.cameraScanImage);
            return;
        }
        this.cameraScanImage = new Image;
        this.cameraScanImage.onload = function (_) {
            qrCodeScanRegion.innerHTML = "<br>";
            qrCodeScanRegion.appendChild($this.cameraScanImage);
        };
        this.cameraScanImage.width = 64;
        this.cameraScanImage.style.opacity = "0.8";
        this.cameraScanImage.src = image_assets_1.ASSET_CAMERA_SCAN;
        this.cameraScanImage.alt = strings_1.Html5QrcodeScannerStrings.cameraScanAltText();
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
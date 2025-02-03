import { Html5QrcodeConstants, Html5QrcodeScanType, Html5QrcodeErrorFactory, BaseLoggger, isNullOrUndefined, } from "./core";
import { Html5Qrcode, } from "./html5-qrcode";
import { Html5QrcodeScannerStrings, } from "./strings";
import { ASSET_CAMERA_SCAN, } from "./image-assets";
import { PersistedDataManager } from "./storage";
import { LibraryInfoContainer } from "./ui";
import { CameraPermissions } from "./camera/permissions";
import { ScanTypeSelector } from "./ui/scanner/scan-type-selector";
import { FileSelectionUi } from "./ui/scanner/file-selection-ui";
import { BaseUiElementFactory, PublicUiElementIdAndClasses } from "./ui/scanner/base";
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
export class Html5QrcodeScanner {
    constructor(elementId, config, verbose) {
        this.lastMatchFound = null;
        this.cameraScanImage = null;
        this.fileScanImage = null;
        this.fileSelectionUi = null;
        this.elementId = elementId;
        this.config = this.createConfig(config);
        this.verbose = verbose === true;
        if (!document.getElementById(elementId)) {
            throw `HTML Element with id=${elementId} not found`;
        }
        this.scanTypeSelector = new ScanTypeSelector(this.config.supportedScanTypes);
        this.currentScanType = this.scanTypeSelector.getDefaultScanType();
        this.sectionSwapAllowed = true;
        this.logger = new BaseLoggger(this.verbose);
        this.persistedDataManager = new PersistedDataManager();
        if (config.rememberLastUsedCamera !== true) {
            this.persistedDataManager.reset();
        }
    }
    render(qrCodeSuccessCallback, qrCodeErrorCallback) {
        this.lastMatchFound = null;
        this.qrCodeSuccessCallback
            = (decodedText, result) => {
                if (qrCodeSuccessCallback) {
                    qrCodeSuccessCallback(decodedText, result);
                }
                else {
                    if (this.lastMatchFound === decodedText) {
                        return;
                    }
                    this.lastMatchFound = decodedText;
                    this.setHeaderMessage(Html5QrcodeScannerStrings.lastMatch(decodedText), Html5QrcodeScannerStatus.STATUS_SUCCESS);
                }
            };
        this.qrCodeErrorCallback =
            (errorMessage, error) => {
                if (qrCodeErrorCallback) {
                    qrCodeErrorCallback(errorMessage, error);
                }
            };
        const container = document.getElementById(this.elementId);
        if (!container) {
            throw `HTML Element with id=${this.elementId} not found`;
        }
        container.innerHTML = "";
        this.createBasicLayout(container);
        this.html5Qrcode = new Html5Qrcode(this.getScanRegionId(), toHtml5QrcodeFullConfig(this.config, this.verbose));
        this.startCameraScan();
    }
    startCameraScan() {
        const $this = this;
        Html5Qrcode.getCameras().then((cameras) => {
            if (cameras && cameras.length > 0) {
                const cameraId = cameras[0].id;
                $this.html5Qrcode.start(cameraId, toHtml5QrcodeCameraScanConfig($this.config), $this.qrCodeSuccessCallback, $this.qrCodeErrorCallback).catch((error) => {
                    console.error("Unable to start scanning: ", error);
                });
            }
            else {
                $this.setHeaderMessage(Html5QrcodeScannerStrings.noCameraFound(), Html5QrcodeScannerStatus.STATUS_WARNING);
            }
        }).catch((error) => {
            $this.setHeaderMessage(error, Html5QrcodeScannerStatus.STATUS_WARNING);
        });
    }
    pause(shouldPauseVideo) {
        if (isNullOrUndefined(shouldPauseVideo) || shouldPauseVideo !== true) {
            shouldPauseVideo = false;
        }
        this.getHtml5QrcodeOrFail().pause(shouldPauseVideo);
    }
    resume() {
        this.getHtml5QrcodeOrFail().resume();
    }
    getState() {
        return this.getHtml5QrcodeOrFail().getState();
    }
    clear() {
        const emptyHtmlContainer = () => {
            const mainContainer = document.getElementById(this.elementId);
            if (mainContainer) {
                mainContainer.innerHTML = "";
                this.resetBasicLayout(mainContainer);
            }
        };
        if (this.html5Qrcode) {
            return new Promise((resolve, reject) => {
                if (!this.html5Qrcode) {
                    resolve();
                    return;
                }
                if (this.html5Qrcode.isScanning) {
                    this.html5Qrcode.stop().then((_) => {
                        if (!this.html5Qrcode) {
                            resolve();
                            return;
                        }
                        this.html5Qrcode.clear();
                        emptyHtmlContainer();
                        resolve();
                    }).catch((error) => {
                        if (this.verbose) {
                            this.logger.logError("Unable to stop qrcode scanner", error);
                        }
                        reject(error);
                    });
                }
                else {
                    this.html5Qrcode.clear();
                    emptyHtmlContainer();
                    resolve();
                }
            });
        }
        return Promise.resolve();
    }
    getRunningTrackCapabilities() {
        return this.getHtml5QrcodeOrFail().getRunningTrackCapabilities();
    }
    getRunningTrackSettings() {
        return this.getHtml5QrcodeOrFail().getRunningTrackSettings();
    }
    applyVideoConstraints(videoConstaints) {
        return this.getHtml5QrcodeOrFail().applyVideoConstraints(videoConstaints);
    }
    getHtml5QrcodeOrFail() {
        if (!this.html5Qrcode) {
            throw "Code scanner not initialized.";
        }
        return this.html5Qrcode;
    }
    createConfig(config) {
        if (config) {
            if (!config.fps) {
                config.fps = Html5QrcodeConstants.SCAN_DEFAULT_FPS;
            }
            if (config.rememberLastUsedCamera !== (!Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED)) {
                config.rememberLastUsedCamera
                    = Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED;
            }
            config.supportedScanTypes = [Html5QrcodeScanType.SCAN_TYPE_CAMERA];
            return config;
        }
        return {
            fps: Html5QrcodeConstants.SCAN_DEFAULT_FPS,
            rememberLastUsedCamera: Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        };
    }
    createBasicLayout(parent) {
        parent.style.position = "fixed";
        parent.style.top = "0";
        parent.style.left = "0";
        parent.style.width = "100vw";
        parent.style.height = "100vh";
        parent.style.padding = "0";
        parent.style.margin = "0";
        parent.style.border = "none";
        parent.style.overflow = "hidden";
        const qrCodeScanRegion = document.createElement("div");
        const scanRegionId = this.getScanRegionId();
        qrCodeScanRegion.id = scanRegionId;
        qrCodeScanRegion.style.width = "100%";
        qrCodeScanRegion.style.height = "100%";
        qrCodeScanRegion.style.position = "absolute";
        qrCodeScanRegion.style.top = "0";
        qrCodeScanRegion.style.left = "0";
        qrCodeScanRegion.style.zIndex = "1";
        parent.appendChild(qrCodeScanRegion);
        const qrCodeDashboard = document.createElement("div");
        const dashboardId = this.getDashboardId();
        qrCodeDashboard.id = dashboardId;
        qrCodeDashboard.style.width = "100%";
        qrCodeDashboard.style.position = "absolute";
        qrCodeDashboard.style.bottom = "0";
        qrCodeDashboard.style.zIndex = "2";
        qrCodeDashboard.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        qrCodeDashboard.style.padding = "10px";
        qrCodeDashboard.style.boxSizing = "border-box";
        parent.appendChild(qrCodeDashboard);
        this.setupInitialDashboard(qrCodeDashboard);
    }
    resetBasicLayout(mainContainer) {
        mainContainer.style.border = "none";
    }
    setupInitialDashboard(dashboard) {
        this.createSection(dashboard);
        this.createSectionControlPanel();
    }
    createHeader(dashboard) {
        const header = document.createElement("div");
        header.style.textAlign = "left";
        header.style.margin = "0px";
        dashboard.appendChild(header);
        let libraryInfo = new LibraryInfoContainer();
        libraryInfo.renderInto(header);
        const headerMessageContainer = document.createElement("div");
        headerMessageContainer.id = this.getHeaderMessageContainerId();
        headerMessageContainer.style.display = "none";
        headerMessageContainer.style.textAlign = "center";
        headerMessageContainer.style.fontSize = "14px";
        headerMessageContainer.style.padding = "2px 10px";
        headerMessageContainer.style.margin = "4px";
        headerMessageContainer.style.borderTop = "1px solid #f6f6f6";
        header.appendChild(headerMessageContainer);
    }
    createSection(dashboard) {
        const section = document.createElement("div");
        section.id = this.getDashboardSectionId();
        section.style.width = "100%";
        section.style.padding = "10px 0px 10px 0px";
        section.style.textAlign = "left";
        dashboard.appendChild(section);
    }
    createCameraListUi(scpCameraScanRegion, requestPermissionContainer, requestPermissionButton) {
        const $this = this;
        $this.showHideScanTypeSwapLink(false);
        $this.setHeaderMessage(Html5QrcodeScannerStrings.cameraPermissionRequesting());
        const createPermissionButtonIfNotExists = () => {
            if (!requestPermissionButton) {
                $this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
            }
        };
        Html5Qrcode.getCameras().then((cameras) => {
            $this.persistedDataManager.setHasPermission(true);
            $this.showHideScanTypeSwapLink(true);
            $this.resetHeaderMessage();
            if (cameras && cameras.length > 0) {
                scpCameraScanRegion.removeChild(requestPermissionContainer);
                $this.renderCameraSelection(cameras);
            }
            else {
                $this.setHeaderMessage(Html5QrcodeScannerStrings.noCameraFound(), Html5QrcodeScannerStatus.STATUS_WARNING);
                createPermissionButtonIfNotExists();
            }
        }).catch((error) => {
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
    }
    createPermissionButton(scpCameraScanRegion, requestPermissionContainer) {
        const $this = this;
        const requestPermissionButton = BaseUiElementFactory
            .createElement("button", this.getCameraPermissionButtonId());
        requestPermissionButton.innerText
            = Html5QrcodeScannerStrings.cameraPermissionTitle();
        requestPermissionButton.addEventListener("click", function () {
            requestPermissionButton.disabled = true;
            $this.createCameraListUi(scpCameraScanRegion, requestPermissionContainer, requestPermissionButton);
        });
        requestPermissionContainer.appendChild(requestPermissionButton);
    }
    createPermissionsUi(scpCameraScanRegion, requestPermissionContainer) {
        const $this = this;
        if (ScanTypeSelector.isCameraScanType(this.currentScanType)
            && this.persistedDataManager.hasCameraPermissions()) {
            CameraPermissions.hasPermissions().then((hasPermissions) => {
                if (hasPermissions) {
                    $this.createCameraListUi(scpCameraScanRegion, requestPermissionContainer);
                }
                else {
                    $this.persistedDataManager.setHasPermission(false);
                    $this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
                }
            }).catch((_) => {
                $this.persistedDataManager.setHasPermission(false);
                $this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
            });
            return;
        }
        this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
    }
    createSectionControlPanel() {
        const section = document.getElementById(this.getDashboardSectionId());
        const sectionControlPanel = document.createElement("div");
        section.appendChild(sectionControlPanel);
        const scpCameraScanRegion = document.createElement("div");
        scpCameraScanRegion.id = this.getDashboardSectionCameraScanRegionId();
        scpCameraScanRegion.style.display = "block";
        sectionControlPanel.appendChild(scpCameraScanRegion);
        const requestPermissionContainer = document.createElement("div");
        requestPermissionContainer.style.textAlign = "center";
        scpCameraScanRegion.appendChild(requestPermissionContainer);
        this.createPermissionsUi(scpCameraScanRegion, requestPermissionContainer);
    }
    renderFileScanUi(parent) {
        let showOnRender = ScanTypeSelector.isFileScanType(this.currentScanType);
        const $this = this;
        let onFileSelected = (file) => {
            if (!$this.html5Qrcode) {
                throw "html5Qrcode not defined";
            }
            if (!ScanTypeSelector.isFileScanType($this.currentScanType)) {
                return;
            }
            $this.setHeaderMessage(Html5QrcodeScannerStrings.loadingImage());
            $this.html5Qrcode.scanFileV2(file, true)
                .then((html5qrcodeResult) => {
                $this.resetHeaderMessage();
                $this.qrCodeSuccessCallback(html5qrcodeResult.decodedText, html5qrcodeResult);
            })
                .catch((error) => {
                $this.setHeaderMessage(error, Html5QrcodeScannerStatus.STATUS_WARNING);
                $this.qrCodeErrorCallback(error, Html5QrcodeErrorFactory.createFrom(error));
            });
        };
        this.fileSelectionUi = FileSelectionUi.create(parent, showOnRender, onFileSelected);
    }
    renderCameraSelection(cameras) {
        const $this = this;
        const scpCameraScanRegion = document.getElementById($this.getDashboardSectionCameraScanRegionId());
        scpCameraScanRegion.style.textAlign = "center";
        const cameraId = cameras[0].id;
        $this.html5Qrcode.start(cameraId, toHtml5QrcodeCameraScanConfig($this.config), $this.qrCodeSuccessCallback, $this.qrCodeErrorCallback).then(() => {
            const videoElement = document.querySelector("video");
            if (videoElement) {
                videoElement.style.width = "100%";
                videoElement.style.height = "100%";
                videoElement.style.objectFit = "cover";
            }
        }).catch((error) => {
            console.error("Unable to start scanning: ", error);
        });
        const cameraSelector = document.createElement("select");
        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.id;
            option.text = camera.label;
            cameraSelector.appendChild(option);
        });
        cameraSelector.onchange = (event) => {
            $this.html5Qrcode.stop().then(() => {
                const selectedCameraId = event.target.value;
                $this.html5Qrcode.start(selectedCameraId, toHtml5QrcodeCameraScanConfig($this.config), $this.qrCodeSuccessCallback, $this.qrCodeErrorCallback).then(() => {
                    const videoElement = document.querySelector("video");
                    if (videoElement) {
                        videoElement.style.width = "100%";
                        videoElement.style.height = "100%";
                        videoElement.style.objectFit = "cover";
                    }
                });
            }).catch((error) => {
                console.error("Unable to switch cameras: ", error);
            });
        };
        scpCameraScanRegion.appendChild(cameraSelector);
    }
    createSectionSwap() {
        const $this = this;
        const TEXT_IF_CAMERA_SCAN_SELECTED = Html5QrcodeScannerStrings.textIfCameraScanSelected();
        const TEXT_IF_FILE_SCAN_SELECTED = Html5QrcodeScannerStrings.textIfFileScanSelected();
        const section = document.getElementById(this.getDashboardSectionId());
        const switchContainer = document.createElement("div");
        switchContainer.style.textAlign = "center";
        const switchScanTypeLink = BaseUiElementFactory.createElement("span", this.getDashboardSectionSwapLinkId());
        switchScanTypeLink.style.textDecoration = "underline";
        switchScanTypeLink.style.cursor = "pointer";
        switchScanTypeLink.innerText
            = ScanTypeSelector.isCameraScanType(this.currentScanType)
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
            if (ScanTypeSelector.isCameraScanType($this.currentScanType)) {
                $this.clearScanRegion();
                $this.getCameraScanRegion().style.display = "none";
                $this.fileSelectionUi.show();
                switchScanTypeLink.innerText = TEXT_IF_FILE_SCAN_SELECTED;
                $this.currentScanType = Html5QrcodeScanType.SCAN_TYPE_FILE;
            }
            else {
                $this.clearScanRegion();
                $this.getCameraScanRegion().style.display = "block";
                $this.fileSelectionUi.hide();
                switchScanTypeLink.innerText = TEXT_IF_CAMERA_SCAN_SELECTED;
                $this.currentScanType = Html5QrcodeScanType.SCAN_TYPE_CAMERA;
                $this.insertCameraScanImageToScanRegion();
                $this.startCameraScanIfPermissionExistsOnSwap();
            }
            $this.sectionSwapAllowed = true;
        });
        switchContainer.appendChild(switchScanTypeLink);
        section.appendChild(switchContainer);
    }
    startCameraScanIfPermissionExistsOnSwap() {
        const $this = this;
        if (this.persistedDataManager.hasCameraPermissions()) {
            CameraPermissions.hasPermissions().then((hasPermissions) => {
                if (hasPermissions) {
                    let permissionButton = document.getElementById($this.getCameraPermissionButtonId());
                    if (!permissionButton) {
                        this.logger.logError("Permission button not found, fail;");
                        throw "Permission button not found";
                    }
                    permissionButton.click();
                }
                else {
                    $this.persistedDataManager.setHasPermission(false);
                }
            }).catch((_) => {
                $this.persistedDataManager.setHasPermission(false);
            });
            return;
        }
    }
    resetHeaderMessage() {
        const messageDiv = document.getElementById(this.getHeaderMessageContainerId());
        messageDiv.style.display = "none";
    }
    setHeaderMessage(messageText, scannerStatus) {
        if (!scannerStatus) {
            scannerStatus = Html5QrcodeScannerStatus.STATUS_DEFAULT;
        }
        const messageDiv = this.getHeaderMessageDiv();
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
    }
    showHideScanTypeSwapLink(shouldDisplay) {
        if (this.scanTypeSelector.hasMoreThanOneScanType()) {
            if (shouldDisplay !== true) {
                shouldDisplay = false;
            }
            this.sectionSwapAllowed = shouldDisplay;
            this.getDashboardSectionSwapLink().style.display
                = shouldDisplay ? "inline-block" : "none";
        }
    }
    insertCameraScanImageToScanRegion() {
        const $this = this;
        const qrCodeScanRegion = document.getElementById(this.getScanRegionId());
        if (this.cameraScanImage) {
            qrCodeScanRegion.innerHTML = "<br>";
            qrCodeScanRegion.appendChild(this.cameraScanImage);
            return;
        }
        this.cameraScanImage = new Image;
        this.cameraScanImage.onload = (_) => {
            qrCodeScanRegion.innerHTML = "<br>";
            qrCodeScanRegion.appendChild($this.cameraScanImage);
        };
        this.cameraScanImage.style.width = "100%";
        this.cameraScanImage.style.height = "100%";
        this.cameraScanImage.style.objectFit = "cover";
        this.cameraScanImage.style.opacity = "0.8";
        this.cameraScanImage.src = ASSET_CAMERA_SCAN;
        this.cameraScanImage.alt = Html5QrcodeScannerStrings.cameraScanAltText();
    }
    clearScanRegion() {
        const qrCodeScanRegion = document.getElementById(this.getScanRegionId());
        qrCodeScanRegion.innerHTML = "";
    }
    getDashboardSectionId() {
        return `${this.elementId}__dashboard_section`;
    }
    getDashboardSectionCameraScanRegionId() {
        return `${this.elementId}__dashboard_section_csr`;
    }
    getDashboardSectionSwapLinkId() {
        return PublicUiElementIdAndClasses.SCAN_TYPE_CHANGE_ANCHOR_ID;
    }
    getScanRegionId() {
        return `${this.elementId}__scan_region`;
    }
    getDashboardId() {
        return `${this.elementId}__dashboard`;
    }
    getHeaderMessageContainerId() {
        return `${this.elementId}__header_message`;
    }
    getCameraPermissionButtonId() {
        return PublicUiElementIdAndClasses.CAMERA_PERMISSION_BUTTON_ID;
    }
    getCameraScanRegion() {
        return document.getElementById(this.getDashboardSectionCameraScanRegionId());
    }
    getDashboardSectionSwapLink() {
        return document.getElementById(this.getDashboardSectionSwapLinkId());
    }
    getHeaderMessageDiv() {
        return document.getElementById(this.getHeaderMessageContainerId());
    }
}
//# sourceMappingURL=html5-qrcode-scanner.js.map
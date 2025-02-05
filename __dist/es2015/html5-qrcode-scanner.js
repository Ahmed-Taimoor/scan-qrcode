var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Html5QrcodeConstants, Html5QrcodeScanType, BaseLoggger, isNullOrUndefined, } from "./core";
import { Html5Qrcode, } from "./html5-qrcode";
import { Html5QrcodeScannerStrings, } from "./strings";
import { PersistedDataManager } from "./storage";
import { LibraryInfoContainer } from "./ui";
import { CameraPermissions } from "./camera/permissions";
import { ScanTypeSelector } from "./ui/scanner/scan-type-selector";
import { BaseUiElementFactory, PublicUiElementIdAndClasses } from "./ui/scanner/base";
import { CameraSelectionUi } from "./ui/scanner/camera-selection-ui";
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
        this.isTransitioning = false;
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
        this.qrCodeSuccessCallback = (decodedText, result) => {
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
        this.qrCodeErrorCallback = (errorMessage, error) => {
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
        this.startCameraAutomatically();
    }
    getCameraFacingMode(cameraId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const stream = yield navigator.mediaDevices.getUserMedia({ video: { deviceId: cameraId } });
                const track = stream.getVideoTracks()[0];
                const settings = track.getSettings();
                stream.getTracks().forEach(track => track.stop());
                return settings.facingMode === 'environment' || settings.facingMode === 'user'
                    ? settings.facingMode
                    : undefined;
            }
            catch (error) {
                console.error("Error getting camera facing mode:", error);
                return undefined;
            }
        });
    }
    startCameraAutomatically() {
        const scpCameraScanRegion = document.getElementById(this.getDashboardSectionCameraScanRegionId());
        const requestPermissionContainer = document.createElement("div");
        this.createCameraListUi(scpCameraScanRegion, requestPermissionContainer);
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
            config.supportedScanTypes = [Html5QrcodeScanType.SCAN_TYPE_CAMERA];
            if (config.rememberLastUsedCamera !== (!Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED)) {
                config.rememberLastUsedCamera
                    = Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED;
            }
            return config;
        }
        return {
            fps: Html5QrcodeConstants.SCAN_DEFAULT_FPS,
            rememberLastUsedCamera: Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        };
    }
    createBasicLayout(parent) {
        parent.style.position = "relative";
        parent.style.padding = "0px";
        parent.style.border = "none";
        const style = document.createElement('style');
        style.textContent = `
        /* Hide duplicate elements */
        #${this.getDashboardSectionCameraScanRegionId()} span:not(:first-child) {
            display: none !important;
        }
        #${this.getDashboardSectionCameraScanRegionId()} select:not(:first-of-type) {
            display: none !important;
        }
        
       /* Mobile-first styles */
#${this.elementId} {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100vh !important; /* Full viewport height */
    margin: 0 !important;
    padding: 0 !important;
    z-index: 9999 !important;
    background: #000 !important;
}
#${this.getScanRegionId()} svg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1; /* Ensure it's above the video */
    pointer-events: none; /* Ensure it doesn't block interactions */
}
#${this.getScanRegionId()} {
    width: 100% !important;
    height: 100% !important; /* Take up full height of the parent */
    min-height: unset !important;
    max-height: unset !important;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
}

#${this.getScanRegionId()} video {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover; /* Ensures the video fills the container without distortion */
}

/* Dashboard section styling */
#${this.getDashboardId()} {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background: rgba(0, 0, 0, 0.7);
    padding: 10px;
    z-index: 10000;
}

/* Camera selection dropdown */
#html5-qrcode-select-camera {
    padding: 12px;
    font-size: 16px;
    margin: 10px auto;
    border-radius: 8px;
    border: 1px solid #ddd;
    width: 90%;
    max-width: 400px;
    display: block;
    background: white;
}

/* Header styling */
#${this.getHeaderMessageContainerId()} {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    background: rgba(0, 0, 0, 0.7);
    color: white !important;
    padding: 10px;
    z-index: 10000;
    text-align: center;
}

/* Desktop styles */
@media (min-width: 768px) {
    #${this.elementId} {
        position: relative !important;
        width: 800px !important;
        height: 800px !important;
        margin: 0 auto !important;
        background: #f8f8f8 !important;
    }

    
    #${this.getScanRegionId()} {
        aspect-ratio: 1 / 1;
        border-radius: 8px;
        overflow: hidden;
    }
    
    #${this.getDashboardId()} {
        position: relative;
        background: none;
    }
    
    #${this.getHeaderMessageContainerId()} {
        position: relative;
        background: none;
        color: inherit !important;
    }
}
    `;
        document.head.appendChild(style);
        this.createHeader(parent);
        const qrCodeScanRegion = document.createElement("div");
        const scanRegionId = this.getScanRegionId();
        qrCodeScanRegion.id = scanRegionId;
        parent.appendChild(qrCodeScanRegion);
        if (ScanTypeSelector.isCameraScanType(this.currentScanType)) {
            this.insertCameraScanImageToScanRegion();
        }
        const qrCodeDashboard = document.createElement("div");
        const dashboardId = this.getDashboardId();
        qrCodeDashboard.id = dashboardId;
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
        if (this.isTransitioning) {
            return;
        }
        const $this = this;
        $this.showHideScanTypeSwapLink(false);
        $this.setHeaderMessage(Html5QrcodeScannerStrings.cameraPermissionRequesting());
        scpCameraScanRegion.innerHTML = '';
        Html5Qrcode.getCameras().then((cameras) => {
            $this.persistedDataManager.setHasPermission(true);
            $this.showHideScanTypeSwapLink(true);
            $this.resetHeaderMessage();
            if (cameras && cameras.length > 0) {
                if (requestPermissionContainer && requestPermissionContainer.parentElement) {
                    requestPermissionContainer.parentElement.removeChild(requestPermissionContainer);
                }
                if (!document.getElementById(PublicUiElementIdAndClasses.CAMERA_SELECTION_SELECT_ID)) {
                    $this.renderCameraSelection(cameras);
                }
            }
            else {
                $this.setHeaderMessage(Html5QrcodeScannerStrings.noCameraFound(), Html5QrcodeScannerStatus.STATUS_WARNING);
                if (!requestPermissionButton) {
                    $this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
                }
            }
        }).catch((error) => {
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
        if (!requestPermissionContainer.parentElement) {
            scpCameraScanRegion.appendChild(requestPermissionContainer);
        }
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
        const existingControlPanel = section.querySelector('div');
        if (existingControlPanel) {
            section.removeChild(existingControlPanel);
        }
        const sectionControlPanel = document.createElement("div");
        section.appendChild(sectionControlPanel);
        const scpCameraScanRegion = document.createElement("div");
        scpCameraScanRegion.id = this.getDashboardSectionCameraScanRegionId();
        scpCameraScanRegion.style.display = "block";
        sectionControlPanel.appendChild(scpCameraScanRegion);
        const requestPermissionContainer = document.createElement("div");
        requestPermissionContainer.style.textAlign = "center";
        requestPermissionContainer.id = `${this.elementId}__permission_container`;
        this.createPermissionsUi(scpCameraScanRegion, requestPermissionContainer);
    }
    startCameraScanning(cameraId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.html5Qrcode) {
                throw "html5Qrcode not defined";
            }
            if (this.isTransitioning) {
                console.log("Camera transition in progress, please wait");
                return;
            }
            try {
                this.isTransitioning = true;
                if (this.html5Qrcode.isScanning) {
                    yield this.html5Qrcode.stop();
                    yield new Promise(resolve => setTimeout(resolve, 300));
                }
                yield new Promise(resolve => setTimeout(resolve, 300));
                yield this.html5Qrcode.start(cameraId, {
                    fps: this.config.fps || 10,
                    qrbox: this.config.qrbox,
                    aspectRatio: 1.0,
                    disableFlip: false
                }, this.qrCodeSuccessCallback, this.qrCodeErrorCallback);
            }
            catch (error) {
                console.error("Camera error:", error);
            }
            finally {
                this.isTransitioning = false;
            }
        });
    }
    renderCameraSelection(cameras) {
        return __awaiter(this, void 0, void 0, function* () {
            const scpCameraScanRegion = document.getElementById(this.getDashboardSectionCameraScanRegionId());
            scpCameraScanRegion.innerHTML = '';
            scpCameraScanRegion.style.textAlign = "center";
            let rearCamera;
            for (const camera of cameras) {
                const facingMode = yield this.getCameraFacingMode(camera.id);
                if (facingMode === 'environment') {
                    rearCamera = camera;
                    break;
                }
            }
            const defaultCamera = rearCamera || cameras[0];
            let cameraSelectUi = null;
            try {
                cameraSelectUi = CameraSelectionUi.create(scpCameraScanRegion, cameras);
            }
            catch (error) {
                console.error("Error creating camera selection UI:", error);
                return;
            }
            if (defaultCamera && cameraSelectUi) {
                try {
                    cameraSelectUi.setValue(defaultCamera.id);
                    yield this.startCameraScanning(defaultCamera.id);
                }
                catch (error) {
                    console.error("Error starting camera:", error);
                }
            }
            const cameraSelectElement = document.getElementById(PublicUiElementIdAndClasses.CAMERA_SELECTION_SELECT_ID);
            if (cameraSelectElement) {
                const newElement = cameraSelectElement.cloneNode(true);
                if (cameraSelectElement.parentNode) {
                    cameraSelectElement.parentNode.replaceChild(newElement, cameraSelectElement);
                }
                newElement.addEventListener('change', (event) => {
                    const selectedCameraId = event.target.value;
                    this.startCameraScanning(selectedCameraId);
                });
            }
        });
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
        const qrCodeScanRegion = document.getElementById(this.getScanRegionId());
        qrCodeScanRegion.innerHTML = "<br>";
        const svgHtml = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 47.5C40.5604 47.5 47.5 40.5604 47.5 32C47.5 23.4396 40.5604 16.5 32 16.5C23.4396 16.5 16.5 23.4396 16.5 32C16.5 40.5604 23.4396 47.5 32 47.5Z" stroke="currentColor" stroke-width="3"/>
            <path d="M32 39.5C36.6944 39.5 40.5 35.6944 40.5 31C40.5 26.3056 36.6944 22.5 32 22.5C27.3056 22.5 23.5 26.3056 23.5 31C23.5 35.6944 27.3056 39.5 32 39.5Z" fill="currentColor"/>
        </svg>`;
        qrCodeScanRegion.insertAdjacentHTML('beforeend', svgHtml);
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
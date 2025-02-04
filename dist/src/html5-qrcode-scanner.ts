/**
 * @module
 * Complete Scanner build on top of {@link Html5Qrcode}.
 * - Decode QR Code using web cam or smartphone camera
 * 
 * @author mebjas <minhazav@gmail.com>
 * 
 * The word "QR Code" is registered trademark of DENSO WAVE INCORPORATED
 * http://www.denso-wave.com/qrcode/faqpatent-e.html
 */
import {
    Html5QrcodeConstants,
    Html5QrcodeScanType,
    QrcodeSuccessCallback,
    QrcodeErrorCallback,
    Html5QrcodeResult,
    Html5QrcodeError,
    Html5QrcodeErrorFactory,
    BaseLoggger,
    Logger,
    isNullOrUndefined,
    clip,
} from "./core";

import { CameraCapabilities } from "./camera/core";

import { CameraDevice } from "./camera/core";

import {
    Html5Qrcode,
    Html5QrcodeConfigs,
    Html5QrcodeCameraScanConfig,
    Html5QrcodeFullConfig,
} from "./html5-qrcode";

import {
    Html5QrcodeScannerStrings,
} from "./strings";

import {
    ASSET_FILE_SCAN,
    ASSET_CAMERA_SCAN,
} from "./image-assets";

import {
    PersistedDataManager
} from "./storage";

import {
    LibraryInfoContainer
} from "./ui";

import {
  CameraPermissions
} from "./camera/permissions";

import { Html5QrcodeScannerState } from "./state-manager";

import { ScanTypeSelector } from "./ui/scanner/scan-type-selector";

import { TorchButton } from "./ui/scanner/torch-button";

import {
    FileSelectionUi,
    OnFileSelected
} from "./ui/scanner/file-selection-ui";

import {
    BaseUiElementFactory,
    PublicUiElementIdAndClasses
} from "./ui/scanner/base";

import { CameraSelectionUi } from "./ui/scanner/camera-selection-ui";
import { CameraZoomUi } from "./ui/scanner/camera-zoom-ui";

/**
 * Different states of QR Code Scanner.
 */
enum Html5QrcodeScannerStatus {
    STATUS_DEFAULT = 0,
    STATUS_SUCCESS = 1,
    STATUS_WARNING = 2,
    STATUS_REQUESTING_PERMISSION = 3,
}

/**
 * Interface for controlling different aspects of {@class Html5QrcodeScanner}.
 */
export interface Html5QrcodeScannerConfig
    extends Html5QrcodeCameraScanConfig, Html5QrcodeConfigs {

    /**
     * If `true` the library will remember if the camera permissions
     * were previously granted and what camera was last used. If the permissions
     * is already granted for "camera", QR code scanning will automatically
     * start for previously used camera.
     * 
     * Note: default value is `true`.
     */
    rememberLastUsedCamera?: boolean | undefined;

    /**
     * Sets the desired scan types to be supported in the scanner.
     * 
     *  - Not setting a value will follow the default order supported by
     *      library.
     *  - First value would be used as the default value. Example:
     *    - [SCAN_TYPE_CAMERA, SCAN_TYPE_FILE]: Camera will be default type,
     *      user can switch to file based scan.
     *    - [SCAN_TYPE_FILE, SCAN_TYPE_CAMERA]: File based scan will be default
     *      type, user can switch to camera based scan.
     *  - Setting only value will disable option to switch to other. Example:
     *    - [SCAN_TYPE_CAMERA] - Only camera based scan supported.
     *    - [SCAN_TYPE_FILE] - Only file based scan supported.
     *  - Setting wrong values or multiple values will fail.
     */
    supportedScanTypes?: Array<Html5QrcodeScanType> | [];

    /**
     * If `true` the rendered UI will have button to turn flash on or off
     * based on device + browser support.
     * 
     * Note: default value is `false`.
     */
    showTorchButtonIfSupported?: boolean | undefined;

    /**
     * If `true` the rendered UI will have slider to zoom camera based on
     * device + browser support.
     * 
     * Note: default value is `false`.
     * 
     * TODO(minhazav): Document this API, currently hidden.
     */
    showZoomSliderIfSupported?: boolean | undefined;

    /**
     * Default zoom value if supported.
     * 
     * Note: default value is 1x.
     * 
     * TODO(minhazav): Document this API, currently hidden.
     */
    defaultZoomValueIfSupported?: number | undefined;
}

function toHtml5QrcodeCameraScanConfig(config: Html5QrcodeScannerConfig)
    : Html5QrcodeCameraScanConfig {
    return {
        fps: config.fps,
        qrbox: config.qrbox,
        aspectRatio: config.aspectRatio,
        disableFlip: config.disableFlip,
        videoConstraints: config.videoConstraints
    };
}

function toHtml5QrcodeFullConfig(
    config: Html5QrcodeConfigs, verbose: boolean | undefined)
    : Html5QrcodeFullConfig {
    return {
        formatsToSupport: config.formatsToSupport,
        useBarCodeDetectorIfSupported: config.useBarCodeDetectorIfSupported,
        experimentalFeatures: config.experimentalFeatures,
        verbose: verbose
    };
}

/**
 * End to end web based QR and Barcode Scanner.
 * 
 * Use this class for setting up QR scanner in your web application with
 * few lines of codes.
 * 
 * -   Supports camera as well as file based scanning.
 * -   Depending on device supports camera selection, zoom and torch features.
 * -   Supports different kind of 2D and 1D codes {@link Html5QrcodeSupportedFormats}.
 */
export class Html5QrcodeScanner {

    //#region private fields
    private elementId: string;
    private config: Html5QrcodeScannerConfig;
    private verbose: boolean;
    private currentScanType: Html5QrcodeScanType;
    private sectionSwapAllowed: boolean;
    private persistedDataManager: PersistedDataManager;
    private scanTypeSelector: ScanTypeSelector;
    private logger: Logger;

    // Initally null fields.
    private html5Qrcode: Html5Qrcode | undefined;
    private qrCodeSuccessCallback: QrcodeSuccessCallback | undefined;
    private qrCodeErrorCallback: QrcodeErrorCallback | undefined;
    private lastMatchFound: string | null = null;
    private cameraScanImage: HTMLImageElement | null = null;
    private fileScanImage: HTMLImageElement | null = null;
    private fileSelectionUi: FileSelectionUi | null = null;
    //#endregion

    /**
     * Creates instance of this class.
     *
     * @param elementId Id of the HTML element.
     * @param config Extra configurations to tune the code scanner.
     * @param verbose - If true, all logs would be printed to console. 
     */
    public constructor(
        elementId: string,
        config: Html5QrcodeScannerConfig | undefined,
        verbose: boolean | undefined) {
        this.elementId = elementId;
        this.config = this.createConfig(config);
        this.verbose = verbose === true;

        if (!document.getElementById(elementId)) {
            throw `HTML Element with id=${elementId} not found`;
        }

        this.scanTypeSelector = new ScanTypeSelector(
            this.config.supportedScanTypes);
        this.currentScanType = this.scanTypeSelector.getDefaultScanType();

        this.sectionSwapAllowed = true;
        this.logger = new BaseLoggger(this.verbose);

        this.persistedDataManager = new PersistedDataManager();
        if (config!.rememberLastUsedCamera !== true) {
            this.persistedDataManager.reset();
        }
    }

    /**
     * Renders the User Interface.
     * 
     * @param qrCodeSuccessCallback Callback called when an instance of a QR
     * code or any other supported bar code is found.
     * @param qrCodeErrorCallback optional, callback called in cases where no
     * instance of QR code or any other supported bar code is found.
     */
    public render(
        qrCodeSuccessCallback: QrcodeSuccessCallback,
        qrCodeErrorCallback: QrcodeErrorCallback | undefined) {
        this.lastMatchFound = null;
    
        // Add wrapper to success callback
        this.qrCodeSuccessCallback = (decodedText: string, result: Html5QrcodeResult) => {
            if (qrCodeSuccessCallback) {
                qrCodeSuccessCallback(decodedText, result);
            } else {
                if (this.lastMatchFound === decodedText) {
                    return;
                }
                this.lastMatchFound = decodedText;
                this.setHeaderMessage(
                    Html5QrcodeScannerStrings.lastMatch(decodedText),
                    Html5QrcodeScannerStatus.STATUS_SUCCESS);
            }
        };
    
        // Add wrapper to failure callback
        this.qrCodeErrorCallback = (errorMessage: string, error: Html5QrcodeError) => {
            if (qrCodeErrorCallback) {
                qrCodeErrorCallback(errorMessage, error);
            }
        };
    
        const container = document.getElementById(this.elementId);
        if (!container) {
            throw `HTML Element with id=${this.elementId} not found`;
        }
        container.innerHTML = "";
        this.createBasicLayout(container!);
        this.html5Qrcode = new Html5Qrcode(
            this.getScanRegionId(),
            toHtml5QrcodeFullConfig(this.config, this.verbose));
    
        // Automatically request camera permission and start scanning
        this.startCameraAutomatically();
    }

    private async getCameraFacingMode(cameraId: string): Promise<'environment' | 'user' | undefined> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: cameraId } });
            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();
            stream.getTracks().forEach(track => track.stop()); // Clean up
            return settings.facingMode === 'environment' || settings.facingMode === 'user' 
                ? settings.facingMode 
                : undefined;
        } catch (error) {
            console.error("Error getting camera facing mode:", error);
            return undefined;
        }
    }

    private startCameraAutomatically() {
        const scpCameraScanRegion = document.getElementById(
            this.getDashboardSectionCameraScanRegionId())!;
        const requestPermissionContainer = document.createElement("div");
        this.createCameraListUi(scpCameraScanRegion as HTMLDivElement, requestPermissionContainer as HTMLDivElement);
    }

    //#region State related public APIs
    /**
     * Pauses the ongoing scan.
     * 
     * Notes:
     * -   Should only be called if camera scan is ongoing.
     * 
     * @param shouldPauseVideo (Optional, default = false) If `true`
     * the video will be paused.
     * 
     * @throws error if method is called when scanner is not in scanning state.
     */
    public pause(shouldPauseVideo?: boolean) {
        if (isNullOrUndefined(shouldPauseVideo) || shouldPauseVideo !== true) {
            shouldPauseVideo = false;
        }

        this.getHtml5QrcodeOrFail().pause(shouldPauseVideo);
    }
    
    /**
     * Resumes the paused scan.
     * 
     * If the video was previously paused by setting `shouldPauseVideo`
     * to `true` in {@link Html5QrcodeScanner#pause(shouldPauseVideo)},
     * calling this method will resume the video.
     * 
     * Notes:
     * -   Should only be called if camera scan is ongoing.
     * -   With this caller will start getting results in success and error
     * callbacks.
     * 
     * @throws error if method is called when scanner is not in paused state.
     */
    public resume() {
        this.getHtml5QrcodeOrFail().resume();
    }

    /**
     * Gets state of the camera scan.
     *
     * @returns state of type {@link Html5QrcodeScannerState}.
     */
    public getState(): Html5QrcodeScannerState {
       return this.getHtml5QrcodeOrFail().getState();
    }

    /**
     * Removes the QR Code scanner UI.
     * 
     * @returns Promise which succeeds if the cleanup is complete successfully,
     *  fails otherwise.
     */
    public clear(): Promise<void> {
        const emptyHtmlContainer = () => {
            const mainContainer = document.getElementById(this.elementId);
            if (mainContainer) {
                mainContainer.innerHTML = ""; // Clear the container
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
                } else {
                    this.html5Qrcode.clear();
                    emptyHtmlContainer();
                    resolve();
                }
            });
        }
    
        return Promise.resolve();
    }
    //#endregion

    //#region Beta APIs to modify running stream state.
    /**
     * Returns the capabilities of the running video track.
     * 
     * Read more: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getConstraints
     * 
     * Note: Should only be called if {@link Html5QrcodeScanner#getState()}
     *   returns {@link Html5QrcodeScannerState#SCANNING} or 
     *   {@link Html5QrcodeScannerState#PAUSED}.
     *
     * @returns the capabilities of a running video track.
     * @throws error if the scanning is not in running state.
     */
    public getRunningTrackCapabilities(): MediaTrackCapabilities {
        return this.getHtml5QrcodeOrFail().getRunningTrackCapabilities();
    }

    /**
     * Returns the object containing the current values of each constrainable
     * property of the running video track.
     * 
     * Read more: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings
     * 
     * Note: Should only be called if {@link Html5QrcodeScanner#getState()}
     *   returns {@link Html5QrcodeScannerState#SCANNING} or 
     *   {@link Html5QrcodeScannerState#PAUSED}.
     *
     * @returns the supported settings of the running video track.
     * @throws error if the scanning is not in running state.
     */
    public getRunningTrackSettings(): MediaTrackSettings {
        return this.getHtml5QrcodeOrFail().getRunningTrackSettings();
    }

    /**
     * Apply a video constraints on running video track from camera.
     *
     * Note: Should only be called if {@link Html5QrcodeScanner#getState()}
     *   returns {@link Html5QrcodeScannerState#SCANNING} or 
     *   {@link Html5QrcodeScannerState#PAUSED}.
     *
     * @param {MediaTrackConstraints} specifies a variety of video or camera
     *  controls as defined in
     *  https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
     * @returns a Promise which succeeds if the passed constraints are applied,
     *  fails otherwise.
     * @throws error if the scanning is not in running state.
     */
    public applyVideoConstraints(videoConstaints: MediaTrackConstraints)
        : Promise<void> {
        return this.getHtml5QrcodeOrFail().applyVideoConstraints(videoConstaints);
    }
    //#endregion

    //#region Private methods
    private getHtml5QrcodeOrFail() {
        if (!this.html5Qrcode) {
            throw "Code scanner not initialized.";
        }
        return this.html5Qrcode!;
    }

    private createConfig(config: Html5QrcodeScannerConfig | undefined)
    : Html5QrcodeScannerConfig {
    if (config) {
        if (!config.fps) {
            config.fps = Html5QrcodeConstants.SCAN_DEFAULT_FPS;
        }

        // Force camera scan only
        config.supportedScanTypes = [Html5QrcodeScanType.SCAN_TYPE_CAMERA];

        if (config.rememberLastUsedCamera !== (
            !Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED)) {
            config.rememberLastUsedCamera
                = Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED;
        }

        return config;
    }

    return {
        fps: Html5QrcodeConstants.SCAN_DEFAULT_FPS,
        rememberLastUsedCamera:
            Html5QrcodeConstants.DEFAULT_REMEMBER_LAST_CAMERA_USED,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] // Force camera scan only
    };
}
    private createBasicLayout(parent: HTMLElement) {
        parent.style.position = "relative";
        parent.style.padding = "0px";
        parent.style.border = "1px solid silver";
        this.createHeader(parent);

        const qrCodeScanRegion = document.createElement("div");
        const scanRegionId = this.getScanRegionId();
        qrCodeScanRegion.id = scanRegionId;
        qrCodeScanRegion.style.width = "100%";
        qrCodeScanRegion.style.minHeight = "100px";
        qrCodeScanRegion.style.textAlign = "center";
        parent.appendChild(qrCodeScanRegion);
        if (ScanTypeSelector.isCameraScanType(this.currentScanType)) {
            this.insertCameraScanImageToScanRegion();
        }

        const qrCodeDashboard = document.createElement("div");
        const dashboardId = this.getDashboardId();
        qrCodeDashboard.id = dashboardId;
        qrCodeDashboard.style.width = "100%";
        parent.appendChild(qrCodeDashboard);

        this.setupInitialDashboard(qrCodeDashboard);
    }

    private resetBasicLayout(mainContainer: HTMLElement) {
        mainContainer.style.border = "none";
    }

    private setupInitialDashboard(dashboard: HTMLElement) {
        this.createSection(dashboard);
        this.createSectionControlPanel();
        // if (this.scanTypeSelector.hasMoreThanOneScanType()) {
        //     this.createSectionSwap();
        // }
    }

    private createHeader(dashboard: HTMLElement) {
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

    private createSection(dashboard: HTMLElement) {
        const section = document.createElement("div");
        section.id = this.getDashboardSectionId();
        section.style.width = "100%";
        section.style.padding = "10px 0px 10px 0px";
        section.style.textAlign = "left";
        dashboard.appendChild(section);
    }
    private createCameraListUi(
        scpCameraScanRegion: HTMLDivElement,
        requestPermissionContainer: HTMLDivElement,
        requestPermissionButton?: HTMLButtonElement) {
        
        // Prevent multiple calls if camera list UI is already being created
        if (this.isTransitioning) {
            return;
        }
        
        const $this = this;
        $this.showHideScanTypeSwapLink(false);
        $this.setHeaderMessage(
            Html5QrcodeScannerStrings.cameraPermissionRequesting());
    
        // Clear any existing camera selection UI first
        scpCameraScanRegion.innerHTML = '';
        
        Html5Qrcode.getCameras().then((cameras) => {
            $this.persistedDataManager.setHasPermission(true);
            $this.showHideScanTypeSwapLink(true);
            $this.resetHeaderMessage();
            
            if (cameras && cameras.length > 0) {
                // Remove the permission container if it exists
                if (requestPermissionContainer && requestPermissionContainer.parentElement) {
                    requestPermissionContainer.parentElement.removeChild(
                        requestPermissionContainer);
                }
    
                // Only render if no camera UI exists
                if (!document.getElementById(PublicUiElementIdAndClasses.CAMERA_SELECTION_SELECT_ID)) {
                    $this.renderCameraSelection(cameras);
                }
            } else {
                $this.setHeaderMessage(
                    Html5QrcodeScannerStrings.noCameraFound(),
                    Html5QrcodeScannerStatus.STATUS_WARNING);
                if (!requestPermissionButton) {
                    $this.createPermissionButton(
                        scpCameraScanRegion, requestPermissionContainer);
                }
            }
        }).catch((error) => {
            $this.persistedDataManager.setHasPermission(false);
            if (requestPermissionButton) {
                requestPermissionButton.disabled = false;
            } else {
                $this.createPermissionButton(
                    scpCameraScanRegion, requestPermissionContainer);
            }
            $this.setHeaderMessage(error, Html5QrcodeScannerStatus.STATUS_WARNING);
            $this.showHideScanTypeSwapLink(true);
        });
    }
    

    private createPermissionButton(
        scpCameraScanRegion: HTMLDivElement,
        requestPermissionContainer: HTMLDivElement) {
        const $this = this;
        const requestPermissionButton = BaseUiElementFactory
            .createElement<HTMLButtonElement>(
                "button", this.getCameraPermissionButtonId());
        requestPermissionButton.innerText
            = Html5QrcodeScannerStrings.cameraPermissionTitle();

        requestPermissionButton.addEventListener("click", function () {
            requestPermissionButton.disabled = true;
            $this.createCameraListUi(
                scpCameraScanRegion,
                requestPermissionContainer,
                requestPermissionButton);
        });
        requestPermissionContainer.appendChild(requestPermissionButton);
    }

    private createPermissionsUi(
        scpCameraScanRegion: HTMLDivElement,
        requestPermissionContainer: HTMLDivElement) {
        const $this = this;
    
        // Ensure the container is properly attached
        if (!requestPermissionContainer.parentElement) {
            scpCameraScanRegion.appendChild(requestPermissionContainer);
        }
    
        if (ScanTypeSelector.isCameraScanType(this.currentScanType)
            && this.persistedDataManager.hasCameraPermissions()) {
            CameraPermissions.hasPermissions().then(
                (hasPermissions: boolean) => {
                    if (hasPermissions) {
                        $this.createCameraListUi(
                            scpCameraScanRegion, requestPermissionContainer);
                    } else {
                        $this.persistedDataManager.setHasPermission(false);
                        $this.createPermissionButton(
                            scpCameraScanRegion, requestPermissionContainer);
                    }
                }).catch((_: any) => {
                    $this.persistedDataManager.setHasPermission(false);
                    $this.createPermissionButton(
                        scpCameraScanRegion, requestPermissionContainer);
                });
            return;
        }
    
        this.createPermissionButton(scpCameraScanRegion, requestPermissionContainer);
    }



    private createSectionControlPanel() {
        const section = document.getElementById(this.getDashboardSectionId())!;
        
        // Clear any existing control panel first
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
    
        // Create the requestPermissionContainer
        const requestPermissionContainer = document.createElement("div");
        requestPermissionContainer.style.textAlign = "center";
        requestPermissionContainer.id = `${this.elementId}__permission_container`;
        
        // Initialize permissions UI
        this.createPermissionsUi(scpCameraScanRegion, requestPermissionContainer);
    }

    private isTransitioning = false;

    private async startCameraScanning(cameraId: string) {
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
                await this.html5Qrcode.stop();
                await new Promise(resolve => setTimeout(resolve, 300));
            }
    
            await new Promise(resolve => setTimeout(resolve, 300));
            await this.html5Qrcode.start(
                cameraId,
                {
                    fps: this.config.fps || 10,
                    qrbox: this.config.qrbox,
                    aspectRatio: 1.0,
                    disableFlip: false
                },
                this.qrCodeSuccessCallback!,
                this.qrCodeErrorCallback!
            );
        } catch (error) {
            console.error("Camera error:", error);
            this.setHeaderMessage("Error accessing camera. Please try again.", 
                Html5QrcodeScannerStatus.STATUS_WARNING);
        } finally {
            this.isTransitioning = false;
        }
    }
    
    
    

    private async renderCameraSelection(cameras: Array<CameraDevice>) {
        const scpCameraScanRegion = document.getElementById(
            this.getDashboardSectionCameraScanRegionId())!;
            
        // Clear existing content
        scpCameraScanRegion.innerHTML = '';
        scpCameraScanRegion.style.textAlign = "center";
    
        // Find rear camera (environment-facing)
        let rearCamera: CameraDevice | undefined;
        for (const camera of cameras) {
            const facingMode = await this.getCameraFacingMode(camera.id);
            if (facingMode === 'environment') {
                rearCamera = camera;
                break;
            }
        }
    
        const defaultCamera = rearCamera || cameras[0];
    
        // Only create camera selection UI once
        let cameraSelectUi: CameraSelectionUi | null = null;
        try {
            cameraSelectUi = CameraSelectionUi.create(scpCameraScanRegion, cameras);
        } catch (error) {
            console.error("Error creating camera selection UI:", error);
            return;
        }
    
        if (defaultCamera && cameraSelectUi) {
            try {
                cameraSelectUi.setValue(defaultCamera.id);
                await this.startCameraScanning(defaultCamera.id);
            } catch (error) {
                console.error("Error starting camera:", error);
            }
        }
    
        // Add event listener to the newly created select element
        const cameraSelectElement = document.getElementById(
            PublicUiElementIdAndClasses.CAMERA_SELECTION_SELECT_ID);
        if (cameraSelectElement) {
            // Ensure we don't add multiple listeners
            const newElement = cameraSelectElement.cloneNode(true);
            if (cameraSelectElement.parentNode) {
                cameraSelectElement.parentNode.replaceChild(newElement, cameraSelectElement);
            }
            
            newElement.addEventListener('change', (event) => {
                const selectedCameraId = (event.target as HTMLSelectElement).value;
                this.startCameraScanning(selectedCameraId);
            });
        }
    }
    // Start camera scanning automatically when swapping to camera based scan
    // if set in config and has permission.
    private startCameraScanIfPermissionExistsOnSwap() {
        const $this = this;
        if (this.persistedDataManager.hasCameraPermissions()) {
            CameraPermissions.hasPermissions().then(
                (hasPermissions: boolean) => {
                if (hasPermissions) {
                    // Start feed.
                    // Assuming at this point the permission button exists.
                    let permissionButton = document.getElementById(
                        $this.getCameraPermissionButtonId());
                    if (!permissionButton) {
                        this.logger.logError(
                            "Permission button not found, fail;");
                        throw "Permission button not found";
                    }
                    permissionButton.click();
                } else {
                    $this.persistedDataManager.setHasPermission(
                        /* hasPermission */ false);
                }
            }).catch((_: any) => {
                $this.persistedDataManager.setHasPermission(
                    /* hasPermission */ false);
            });
            return;
        }
    }

    private resetHeaderMessage() {
        const messageDiv = document.getElementById(
            this.getHeaderMessageContainerId())!;
        messageDiv.style.display = "none";
    }

    private setHeaderMessage(
        messageText: string, scannerStatus?: Html5QrcodeScannerStatus) {
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

    private showHideScanTypeSwapLink(shouldDisplay?: boolean) {
        if (this.scanTypeSelector.hasMoreThanOneScanType()) {
            if (shouldDisplay !== true) {
                shouldDisplay = false;
            }

            this.sectionSwapAllowed = shouldDisplay;
            this.getDashboardSectionSwapLink().style.display
                = shouldDisplay ? "inline-block" : "none";
        }
    }

    private insertCameraScanImageToScanRegion() {
        const qrCodeScanRegion = document.getElementById(this.getScanRegionId())!;
        qrCodeScanRegion.innerHTML = "<br>";
        
        // Use inline SVG instead of external asset
        const svgHtml = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 47.5C40.5604 47.5 47.5 40.5604 47.5 32C47.5 23.4396 40.5604 16.5 32 16.5C23.4396 16.5 16.5 23.4396 16.5 32C16.5 40.5604 23.4396 47.5 32 47.5Z" stroke="currentColor" stroke-width="3"/>
            <path d="M32 39.5C36.6944 39.5 40.5 35.6944 40.5 31C40.5 26.3056 36.6944 22.5 32 22.5C27.3056 22.5 23.5 26.3056 23.5 31C23.5 35.6944 27.3056 39.5 32 39.5Z" fill="currentColor"/>
        </svg>`;
        
        qrCodeScanRegion.insertAdjacentHTML('beforeend', svgHtml);
    }


    private clearScanRegion() {
        const qrCodeScanRegion = document.getElementById(
            this.getScanRegionId())!;
        qrCodeScanRegion.innerHTML = "";
    }

    //#region state getters
    private getDashboardSectionId(): string {
        return `${this.elementId}__dashboard_section`;
    }

    private getDashboardSectionCameraScanRegionId(): string {
        return `${this.elementId}__dashboard_section_csr`;
    }

    private getDashboardSectionSwapLinkId(): string {
        return PublicUiElementIdAndClasses.SCAN_TYPE_CHANGE_ANCHOR_ID;
    }

    private getScanRegionId(): string {
        return `${this.elementId}__scan_region`;
    }

    private getDashboardId(): string {
        return `${this.elementId}__dashboard`;
    }

    private getHeaderMessageContainerId(): string {
        return `${this.elementId}__header_message`;
    }

    private getCameraPermissionButtonId(): string {
        return PublicUiElementIdAndClasses.CAMERA_PERMISSION_BUTTON_ID;
    }

    private getCameraScanRegion(): HTMLElement {
        return document.getElementById(
            this.getDashboardSectionCameraScanRegionId())!;
    }

    private getDashboardSectionSwapLink(): HTMLElement {
        return document.getElementById(this.getDashboardSectionSwapLinkId())!;
    }

    private getHeaderMessageDiv(): HTMLElement {
        return document.getElementById(this.getHeaderMessageContainerId())!;
    }
    //#endregion
    //#endregion
}

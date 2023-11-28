import { BrowserWindow, app, session } from "electron";
import buildChromeContextMenu from "electron-chrome-context-menu";
import { ElectronChromeExtensions } from "electron-chrome-extensions";
import path, { join } from "path";
import fs from 'fs/promises';
import { BrowserExtension } from "./browser_extension";
import sharp from 'sharp';
import { EXTENSIONS_DIR } from "../util/directories.util";
import isDev from "electron-is-dev";

export class BrowserExtensionsService {

    session: Electron.Session;
    extensionsApi: ElectronChromeExtensions;
    installedExtensions: Electron.Extension[] = [];
    windows: Map< number, BrowserWindow > = new Map(); 

    onExtensionButtonClick: () => void = () => {};

    constructor() {}

    init = async () => {

        this.session = this.initSession();
        
        this.extensionsApi = new ElectronChromeExtensions({
            session: this.session,
            createTab: async ( details ) => {
                
                const extensionWindow = new BrowserWindow({
                    autoHideMenuBar: true,
                    webPreferences: {
                      sandbox: true,
                      nodeIntegration: false,
                      contextIsolation: true,
                    }
                });

                if (details.url) {                    
                    extensionWindow.loadURL( details.url );                   
                }

                extensionWindow.show();

                return [ extensionWindow.webContents, extensionWindow];
            }
        });
        
        // console.log({ EXTENSIONS_DIR });

        this.installedExtensions = await this.loadExtensions(
            this.session,
            EXTENSIONS_DIR
        );

        // Enable context menu
        app.on('web-contents-created', ( event, webContents ) => {
            webContents.on('context-menu', (e, params) => {

                const extensionMenuItems = this.extensionsApi.getContextMenuItems(webContents, params);

                // Refreshing every window on extension click
                extensionMenuItems.forEach( item => {
                    const { click } = item;
                    item.click = () => {
                        click();
                        this.windows.forEach( window => {
                            window.reload();
                        });
                    }
                });

                const menu = buildChromeContextMenu({
                    params,
                    webContents,
                    extensionMenuItems,
                    openLink: (url, disposition) => {
                        webContents.loadURL(url);
                    }
                });
            
                menu.popup();                
                this.getInstalledExtensions()
            });
        });        

        // console.log(
        //     this.installedExtensions[0].manifest.commands
        // );        
    }

    addBrowserWindow = async ( window: BrowserWindow ) => {

        this.windows.set( window.id, window );

        this.extensionsApi.addTab( window.webContents, window );
        this.extensionsApi.selectTab( window.webContents );        
    }

    getInstalledExtensions = async (): Promise< BrowserExtension[] > => {


        const extensions: BrowserExtension[] = [];

        // console.log( this.installedExtensions );
        // console.log( installedExtensions );

        for ( const item of this.installedExtensions ) {

            const optionsUrl = item.url + item.manifest.options_ui?.page;

            // console.log( item.manifest )

            const extension: BrowserExtension = {
                id: item.id,
                name: item.name,
                optionsUrl,
                icon: await this.getExtensionIcon( item.id ) || ''
            };

            extensions.push( extension );
        }        

        return extensions;
    }

    private loadExtensions = async ( session: Electron.Session, extensionsPath: string ) => {

        const subDirectories = await fs.readdir( extensionsPath, {
            withFileTypes: true,
        });
      
        const extensionDirectories = await Promise.all(
            subDirectories
                .filter( (dirEnt) => dirEnt.isDirectory() )
                .map( async (dirEnt) => {
        
                    const extPath = path.join(extensionsPath, dirEnt.name);
            
                    if ( await this.manifestExists(extPath) ) {
                        return extPath;
                    }
            
                    const extSubDirs = await fs.readdir(extPath, {
                        withFileTypes: true,
                    });
            
                    const versionDirPath =
                        extSubDirs.length === 1 && extSubDirs[0].isDirectory()
                        ? path.join(extPath, extSubDirs[0].name)
                        : null;
            
                    if ( !versionDirPath ) return;
            
                    if ( await this.manifestExists(versionDirPath) ) {
                        return versionDirPath;
                    }
                })
        );
      
        const extensions = [];
      
        for ( const extPath of extensionDirectories.filter(Boolean) ) {
            console.log(`Loading extension from ${extPath}`);
            
            if ( !extPath ) continue;
        
            try {
                const extension = await session.loadExtension(
                    extPath,
                    { allowFileAccess: !isDev } // Required in production
                );
                extensions.push(extension);
            } catch ( error ) {
                console.error( error );
            }
        }
      
        return extensions;
    }

    private manifestExists = async ( dirPath: string ): Promise< boolean > => {

        if ( !dirPath ) return false;
    
        try {
            const manifestPath = path.join(dirPath, 'manifest.json');
            return ( await fs.stat(manifestPath) ).isFile();
        } catch {
            return false;
        }
    }

    private initSession = (): Electron.Session => {

        const { defaultSession } = session;
          
        const userAgent = defaultSession
          .getUserAgent()
          .replace(/\sElectron\/\S+/, '')
          .replace(new RegExp(`\\s${app.getName()}/\\S+`), '');
    
        defaultSession.setUserAgent(userAgent);

        // const browserPreload = path.join( __dirname, '../preload.js' )
        // defaultSession.setPreloads([ browserPreload ]);
        
        return defaultSession;
    }

    private getExtensionIcon = async ( extensionId: string ): Promise< string | undefined > => {

        const extension = this.installedExtensions.find( item => item.id === extensionId );

        if ( !extension ) return;

        const { icons } = extension.manifest;

        const iconRelativePath = icons?.['128'] ||
            icons?.['96'] ||
            icons?.['48'] ||
            icons?.['32'] ||
            icons?.['16'];

        const iconPath = join( extension.path, iconRelativePath );        
        
        const imageBuffer = await sharp( iconPath ).toBuffer();
        const imageBase64 = imageBuffer.toString( 'base64' );        

        return imageBase64;        
    }


    openExtensionOptionsPage = async ( extensionId: string ): Promise<void> => {

        const extensions = await this.getInstalledExtensions();

        const extension = extensions.find( item => item.id === extensionId );

        if ( !extension ) return;

        const extensionWindow = new BrowserWindow({
            autoHideMenuBar: true,
            webPreferences: {
              sandbox: true,
              nodeIntegration: false,
              contextIsolation: true,
            }
        });

        extensionWindow.show();

        extensionWindow.loadURL( extension.optionsUrl );
    }

    handleActionListClick = async () => {

        console.log('handleActionListClick');
        console.log( this.windows );
        this.windows.forEach( window => {
            window.reload();
        });
    }

    installExtension = async (  ) => {

    }
}
import { OcrItem, OcrItemBox, OcrResult, OcrResultContextResolution } from "../ocr_result/ocr_result";

// Position percentages
export type OcrResultBoxPositionPcts = {
    top: number;
    left: number;
};

// Dimensions percentages
export type OcrResultBoxDimensionsPcts = {
    width: number;
    height: number;
};

// Ocr result box percentages to position, scale and rotate the boxes
export type OcrResultBoxScalable = {
    position: OcrResultBoxPositionPcts;
    dimensions?: OcrResultBoxDimensionsPcts;
    angle_degrees?: number;
};

export interface OcrItemScalable {
    text: string;
    box: OcrResultBoxScalable;
    score: number;
};

export interface OcrRegion {
    results: OcrItemScalable[],
    position: { // Percentages
        top: number; 
        left: number;
    };
    size: { // Percentages
        width: number;
        height: number;
    };
};


export type OcrResultScalable_CreationInput = {
    id: number;
    context_resolution?: OcrResultContextResolution;
    results?: OcrItemScalable[];
    ocr_regions?: OcrRegion[];
};

// Scalable version OcrResult. Uses percentages instead of pixel coordinates
export class OcrResultScalable {

    public id: number;
    public context_resolution: OcrResultContextResolution;
    // public results: OcrItemScalable[];
    public ocr_regions: OcrRegion[];
    
    private constructor( input: OcrResultScalable_CreationInput ) {

        this.id = input.id;
        
        this.context_resolution = {
            width: input?.context_resolution?.width || 0,
            height: input?.context_resolution?.height || 0,
        };

        // this.results = input.results ? [ ...input?.results ] : [];
        this.ocr_regions = input?.ocr_regions ? input.ocr_regions : [];
    }

    static create( input: OcrResultScalable_CreationInput ): OcrResultScalable {
        return new OcrResultScalable( input );
    }
    
    // Adds results from another OcrResultScalable as a subregion
    addRegionResult(
        input: {
            regionResult: OcrResultScalable;
            regionPosition: { // Percentages
                top: number; 
                left: number;
            };
            regionSize: {
                width: number;
                height: number;
            },
            globalScaling?: boolean; // true => Use global context resolution instead of region resolution
        }
    ) {
        const { regionResult, regionPosition, regionSize, globalScaling } = input;

        const rescaledRegionResults = regionResult.ocr_regions[0].results.map( result => {

            if ( !globalScaling )
                return result;

            let {
                position: boxPosition,
                dimensions: boxDimensions
            } = result.box;


            result.box.position = {
                top: ( regionPosition.top * 100 ) + ( boxPosition.top * regionSize.height ),
                left: ( regionPosition.left * 100 ) + ( boxPosition.left * regionSize.width ),
            };

            if ( !boxDimensions )
                boxDimensions = { width: 0, height: 0 };

            result.box.dimensions = {
                width: ( boxDimensions.width * regionSize.width ),
                height: ( boxDimensions.height * regionSize.height ),
            };

            return result;
        });

        this.ocr_regions.push({
            results: rescaledRegionResults,
            position: regionPosition,
            size: regionSize
        });

        // this.results = [ ...this.results, ...rescaledRegionResults ];
    }

    static createFromOcrResult( ocrResult: OcrResult ): OcrResultScalable {

        // console.time("createFromOcrResult");

        const results: OcrItemScalable[] = [];
        const ocr_regions: OcrRegion[] = []

        ocrResult.results.forEach( item => {

            const verticalDistance = item.box.top_right.y - item.box.top_left.y;
            const horizontalDistance = item.box.top_right.x - item.box.top_left.x;

            const box_position = OcrResultScalable.calculateBoxPosition(
                item, ocrResult.context_resolution
            );

            const angle_degrees = OcrResultScalable.calculateBoxAngle(
                verticalDistance,
                horizontalDistance
            );

            const width = OcrResultScalable.calculateBoxWidth(
                verticalDistance,
                horizontalDistance,
                ocrResult.context_resolution
            );

            const height = OcrResultScalable.calculateBoxHeight(
                item.box,
                ocrResult.context_resolution,
            );
            
            results.push({
                box: {
                    position: box_position,
                    angle_degrees,
                    dimensions: {
                        width,
                        height,
                    }
                },
                text: item.text,
                score: item.score,
            });

        });

        // console.timeEnd("createFromOcrResult"); // ~0.154ms to ~0.332ms

        ocr_regions.push({
            results,
            position: {
                left: 0,
                top: 0,
            },
            size: {
                height: 1,
                width: 1
            }
        });

        return OcrResultScalable.create({
            id: ocrResult.id,
            results,
            context_resolution: ocrResult.context_resolution,
            ocr_regions
        });
    }

    
    private static calculateBoxPosition( ocrResultItem: OcrItem, contextResolution: OcrResultContextResolution ): OcrResultBoxPositionPcts {

        const { width, height } = contextResolution;

        const topLeftXPixels = ocrResultItem.box.top_left.x;
        const position_left = ( 1 - ( ( width - topLeftXPixels ) / width ) ) * 100;

        const topLeftYPixels = ocrResultItem.box.top_left.y;
        const position_top = ( 1 - ( ( height - topLeftYPixels ) / height ) ) * 100;
        
        return {
            left: position_left,
            top: position_top
        }
    }

    
    private static calculateBoxAngle( verticalDistance: number, horizontalDistance: number ): number {    

        verticalDistance = verticalDistance * -1;

        const negativeRotation = verticalDistance > 0;

        verticalDistance = Math.abs( verticalDistance );
        
        // Ensure height and distance are positive numbers
        if ( verticalDistance <= 0 || horizontalDistance <= 0 )
            return 0; // Invalid input

        // Calculate the angle in radians
        const radians = Math.atan( verticalDistance / horizontalDistance );

        // Convert radians to degrees
        const degrees = radians * (180 / Math.PI);

        if (negativeRotation)
            return -degrees;

        return degrees;
    }

    
    private static calculateBoxWidth(
        verticalDistance: number,
        horizontalDistance: number,
        contextResolution: OcrResultContextResolution
    ): number {    

        const topToLeftHypot = Math.hypot( Math.abs(verticalDistance), horizontalDistance ); // Diagonal distance

        const widthPercent = ( topToLeftHypot / contextResolution.width ) * 100;

        return widthPercent || horizontalDistance;
    }

    
    private static calculateBoxHeight(
        box: OcrItemBox,
        contextResolution: OcrResultContextResolution
    ) {

        const { top_left, bottom_left } = box;

        const topToBottomVerticalDistance = Math.abs(top_left.y - bottom_left.y);        

        const topToBottomHorizontalDistance = Math.abs(top_left.x - bottom_left.x);    

        const topToBottomHypot = Math.hypot( topToBottomVerticalDistance, topToBottomHorizontalDistance ); // Diagonal distance        

        return ( topToBottomHypot / contextResolution.height ) * 100;
    }
}
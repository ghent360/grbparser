/**
 * This file contains classes that convert graphics object primitives from the parset
 * to other formats for example - polygon sets, svg etc.
 */
import {
    LineSegment,
    CircleSegment,
    ArcSegment,
    Line,
    Circle,
    Arc,
    Flash,
    Block,
    BlockSegment,
    BlockContour,
    GraphicsPrimitive
} from "./primitives";
import {formatFloat} from "./utils";

export class DebugConverter {
    convert(primitives:Array<GraphicsPrimitive>):Array<String> {
        let result:Array<String> = [];
        primitives.forEach(p => {
            if (p instanceof Line) {
                let line = p as Line;
                result.push(`Line from ${line.from} to ${line.to}`);
            } else if (p instanceof Arc) {
                let arc = p as Arc;
                result.push(`Arc from ${arc.start} to ${arc.end} R ${formatFloat(arc.radius, 3)}`);
            } else if (p instanceof Circle) {
                let circle = p as Circle;
                result.push(`Cricle at ${circle.center} R ${formatFloat(circle.radius, 3)}`);
            } else if (p instanceof Flash) {
                let flash = p as Flash;
                result.push(`Flash aperture ${flash.aperture.apertureId} at ${flash.center}`);
            } else if (p instanceof Block) {
                let block = p as Block;
                result.push(`Block with ${block.contours.length} contours`);
            }
        });
        return result;
    }
}

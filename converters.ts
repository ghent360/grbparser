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
    GraphicsPrimitive,
    Bounds,
    EmptyBounds,
    Point
} from "./primitives";
import {formatFloat} from "./utils";

abstract class ConverterBase<T> {
    convert(primitives:Array<GraphicsPrimitive>):Array<T> {
        let result:Array<T> = this.header(primitives);
        primitives.forEach(p => {
            if (p instanceof Line) {
                let line = p as Line;
                result.push(this.convertLine(line));
            } else if (p instanceof Arc) {
                let arc = p as Arc;
                result.push(this.convertArc(arc));
            } else if (p instanceof Circle) {
                let circle = p as Circle;
                result.push(this.convertCircle(circle));
            } else if (p instanceof Flash) {
                let flash = p as Flash;
                result.push(this.convertFlash(flash));
            } else if (p instanceof Block) {
                let block = p as Block;
                result.push(this.convertBlock(block));
            } else {
                throw new Error("Unknown primitive " + p);
            }
        });
        return result.concat(this.footer(primitives));
    }

    header(primitives:Array<GraphicsPrimitive>):Array<T> {
        return [];
    }

    footer(primitives:Array<GraphicsPrimitive>):Array<T> {
        return [];
    }

    abstract convertLine(l:Line):T;
    abstract convertArc(a:Arc):T;
    abstract convertCircle(c:Circle):T;
    abstract convertFlash(f:Flash):T;
    abstract convertBlock(b:Block):T;
}

export class DebugConverter {
    convert(primitives:Array<GraphicsPrimitive>):Array<string> {
        let result:Array<string> = [];
        primitives.forEach(p => {
            result.push(p.toString());
        });
        return result;
    }
}

export class SVGConverter extends ConverterBase<string> {
    private margin_ = 10;
    private scale_ = 100;
    private offset_:Point;

    convertLine(l:Line):string {
        let from = l.from.scale(this.scale_).add(this.offset_);
        let to = l.to.scale(this.scale_).add(this.offset_);
        return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`;
    }

    convertArc(a:Arc):string {
        return "";
    }

    convertCircle(c:Circle):string {
        let center = c.center.scale(this.scale_).add(this.offset_);
        return `<circle cx="${center.x}" cy="${center.y}" r="${c.radius * this.scale_}" fill="none" stroke-width="1"/>`;
    }

    convertFlash(f:Flash):string {
        let center = f.center.scale(this.scale_).add(this.offset_);
        let aperture = f.aperture;
        return `<circle cx="${center.x}" cy="${center.y}" r="1" fill="none" stroke-width="1"/>`;
    }

    convertBlock(b:Block):string {
        return "";
    }

    header(primitives:Array<GraphicsPrimitive>):Array<string> {
        let bounds = primitives[0].bounds;
        primitives.forEach(p => bounds.merge(p.bounds));
        let width = bounds.width * this.scale_ + this.margin_ * 2;
        let height = bounds.height * this.scale_ + this.margin_ * 2;
        this.offset_ = new Point(
            -bounds.min.x * this.scale_  + this.margin_,
            -bounds.min.y * this.scale_ + this.margin_);
        
        return ['<?xml version="1.0" standalone="no"?>',
                '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">',
                `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" version="1.1" xmlns="http://www.w3.org/2000/svg">`,
                `<rect x="${this.margin_}" y="${this.margin_}" width="${bounds.width * this.scale_}" height="${bounds.height * this.scale_}" stroke="green" stroke-width="1" fill="none"/>`,
                '<g stroke="black">'];
    }

    footer():Array<string> {
        return ["</g>",
                "</svg>"];
    }
}
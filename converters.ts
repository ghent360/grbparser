/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

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
    Region,
    RegionSegment,
    RegionContour,
    GraphicsPrimitive,
    Bounds,
    EmptyBounds,
    ObjectPolarity,
    GraphicsObjects,
    composeImage,
    Repeat,
} from "./primitives";
import {Point} from "./point";
import {PolygonSet} from "./polygonSet";
import {formatFloat} from "./utils";
import {subtractPolygonSet} from "./polygonSet";

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
            } else if (p instanceof Region) {
                let region = p as Region;
                result.push(this.convertRegion(region));
            } else if (p instanceof Repeat) {
                let repeat = p as Repeat;
                result.push(this.convertRepeat(repeat));
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
    abstract convertRegion(r:Region):T;
    abstract convertRepeat(r:Repeat):T;
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
    private objects_:GraphicsObjects = [];

    convertLine(l:Line):string {
        let polygon = l.aperture.generateLineDraw(l.from, l.to, l.state);
        this.objects_ = this.objects_.concat(l.objects);
        return "";
    }

    convertArc(a:Arc):string {
        let polygon = a.aperture.generateArcDraw(a.start, a.end, a.center, a.state);
        this.objects_ = this.objects_.concat(a.objects);
        return "";
    }

    convertCircle(c:Circle):string {
        let polySet = c.aperture.generateCircleDraw(c.center, c.radius, c.state);
        this.objects_ = this.objects_.concat(c.objects);
        return "";
    }

    convertFlash(f:Flash):string {
        this.objects_ = this.objects_.concat(f.objects);
        return "";
    }

    convertRegion(r:Region):string {
        this.objects_ = this.objects_.concat(r.objects);
        return "";
    }

    convertRepeat(r:Repeat):string {
        this.objects_ = this.objects_.concat(r.objects);
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
        let svg = this.polySetToPath(composeImage(this.objects_));
        return [svg, "</g>", "</svg>"];
    }

    private polySetToPath(polySet:PolygonSet):string {
        let result = '<path d="';
        polySet.filter(polygon => polygon.length > 2).forEach(polygon => {
            let start = polygon[0].scale(this.scale_).add(this.offset_);
            result += ` M ${start.x} ${start.y}`;
            for (let idx = 1; idx < polygon.length; idx++) {
                let point = polygon[idx].scale(this.scale_).add(this.offset_);
                result += ` L ${point.x} ${point.y}`;
            }
        });
        result += ' z" style="fill:#ff1f1c; fill-opacity:1; fill-rule:nonzero; stroke:#000000; stroke-opacity:1; stroke-width:0;"/>'
        return result;
    }
}
/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

/**
 * This file contains classes that convert graphics object primitives from the parser
 * to other formats for example - polygon sets, svg etc.
 */
import {
    Line,
    Circle,
    Arc,
    Flash,
    Region,
    GraphicsPrimitive,
    Bounds,
    ObjectPolarity,
    GraphicsObjects,
    composeSolidImage,
    Repeat,
    GerberState,
    SimpleBounds,
} from "./primitives";
import {Point} from "./point";
import {PolygonSet, waitClipperLoad, connectWires, polySetBounds} from "./polygonSet";
import {GerberParser} from "./grbparser";
import {Build} from "./build";
import { M02Command } from "./gerbercommands";

export abstract class ConverterBase<T> {
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
        result.push(...this.footer(primitives));
        return result;
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

export const Init = waitClipperLoad();
export function WaitInit(callback:() => void) {
    Promise.resolve(waitClipperLoad()).then(() => callback());
}

export class SVGConverter extends ConverterBase<string> {
    public scale = 100;
    public margin = 10;
    public layerColor = 0xff1f1c;
    public precision:number = 3;
    private width_:number = 0;
    private height_:number = 0;
    private offset_:Point = new Point(0, 0);
    private objects_:GraphicsObjects = [];

    convertLine(l:Line):string {
        this.objects_.push(...l.objects);
        return "";
    }

    convertArc(a:Arc):string {
        this.objects_.push(...a.objects);
        return "";
    }

    convertCircle(c:Circle):string {
        this.objects_.push(...c.objects);
        return "";
    }

    convertFlash(f:Flash):string {
        this.objects_.push(...f.objects);
        return "";
    }

    convertRegion(r:Region):string {
        this.objects_.push(...r.objects);
        return "";
    }

    convertRepeat(r:Repeat):string {
        this.objects_.push(...r.objects);
        return "";
    }

    header(primitives:Array<GraphicsPrimitive>):Array<string> {
        let bounds = primitives[0].bounds;
        primitives.forEach(p => bounds.merge(p.bounds));
        this.width_ = bounds.width * this.scale + this.margin * 2;
        this.height_ = bounds.height * this.scale + this.margin * 2;
        this.offset_ = new Point(
            -bounds.min.x * this.scale  + this.margin,
            -bounds.min.y * this.scale + this.margin);
        
        return ['<?xml version="1.0" standalone="no"?>',
                '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">',
                `<svg width="100%" height="100%" viewBox="0 0 ${this.width_} ${this.height_}"
                      version="1.1" xmlns="http://www.w3.org/2000/svg"
                      style="background-color:black">`
                /*`<rect x="${this.margin}" y="${this.margin}"
                       width="${bounds.width * this.scale}" height="${bounds.height * this.scale}"
                       stroke="green" stroke-width="1" fill="none"/>`,*/
                ];
    }

    footer():Array<string> {
        let wires:PolygonSet = []
        this.objects_
            .filter(o => o.polarity == ObjectPolarity.THIN)
            .forEach(p => wires.push(...p.polySet));
        let solids = composeSolidImage(this.objects_);
        wires = connectWires(wires);
        //console.log(`Solids ${solids.length} wires ${wires.length}`);
        if (solids.polygonSet) {
            let svgSolids = this.polySetToSolidPath(solids.polygonSet);
            let svgWires = this.polySetToWirePath(wires);
            return [svgSolids, svgWires, "</g>", "</svg>"];
        }
        return [];
    }

    private polySetToSolidPath(polySet:PolygonSet):string {
        let result = '<path d="';
        polySet
            .filter(polygon => polygon.length > 1)
            .forEach(polygon => {
                let startx = polygon[0] * this.scale + this.offset_.x;
                let starty = polygon[1] * this.scale + this.offset_.y;
                result += ` M ${startx.toFixed(this.precision)} `
                    + `${(this.height_ - starty).toFixed(this.precision)}`;
                for (let idx = 2; idx < polygon.length; idx += 2) {
                    let pointx = polygon[idx] * this.scale + this.offset_.x;
                    let pointy = polygon[idx + 1] * this.scale + this.offset_.y;
                    result += ` L ${pointx.toFixed(this.precision)} `
                        + `${(this.height_ - pointy).toFixed(this.precision)}`;
                }
            });
        result += ' z" ';
        result += `style="fill:${SVGConverter.colorToHtml(this.layerColor)}; fill-opacity:1; fill-rule:nonzero; ` +
            'stroke:#000000; stroke-opacity:1; stroke-width:0;"/>\n';
        return result;
    }

    private polySetToWirePath(polySet:PolygonSet):string {
        if (polySet.length == 0) {
            return "";
        }
        let result = '<path d="';
        polySet
            .filter(polygon => polygon.length > 1)
            .forEach(polygon => {
                let startx = polygon[0] * this.scale + this.offset_.x;
                let starty = polygon[1] * this.scale + this.offset_.y;
                result += ` M ${startx.toFixed(this.precision)} `
                    + `${(this.height_ - starty).toFixed(this.precision)}`;
                for (let idx = 2; idx < polygon.length; idx += 2) {
                    let pointx = polygon[idx] * this.scale + this.offset_.x;
                    let pointy = polygon[idx + 1] * this.scale + this.offset_.y;
                    result += ` L ${pointx.toFixed(this.precision)} `
                        + `${(this.height_ - pointy).toFixed(this.precision)}`;
                }
            });
        result += ' z" ';
        result += `style="stroke:${SVGConverter.colorToHtml(this.layerColor)}; ` +
            `stroke-opacity:1; stroke-width:${this.scale / 10}; fill:none"/>\n`;
        return result;
    }

    private static toString2(n:number):string {
        return ((n >>> 4) & 0xf).toString(16) +
            (n & 0xf).toString(16);
    }
    
    private static colorToHtml(clr:number):string {
        let ss:string;
        ss = '#' + SVGConverter.toString2((clr >>> 16) & 0xff)
            + SVGConverter.toString2((clr >>> 8) & 0xff)
            + SVGConverter.toString2(clr & 0xff);
        return ss;
    }

    public static GerberToSvg(
        content:string,
        isOutline:boolean = false,
        layerColor:number = 0xff1f1c,
        scale:number = 100,
        margin:number = 10):string {
        let parser = new GerberParser();
        parser.parseBlock(content);
        let ctx = new GerberState();
        ctx.isOutlineMode = isOutline;
        parser.execute(ctx);
        if (!ctx.isDone) {
            ctx.endFile(new M02Command("M02"));
        }
        let primitives = ctx.primitives;
        let cvt = new SVGConverter();
        cvt.layerColor = layerColor;
        cvt.scale = scale;
        cvt.margin = margin;
        let svg = cvt.convert(primitives);
        return svg.filter(s => s.length > 0).join('\n');
    }
}

export interface PolygonConverterResult {
    readonly solids:PolygonSet;
    readonly thins:PolygonSet;
    readonly bounds:SimpleBounds;
    readonly primitives:GraphicsPrimitive[];
}

export function GerberToPolygons(
    content:string,
    isOutline:boolean = false,
    tolerance:number = 0.05,
    union:boolean = false):PolygonConverterResult {
    //let start = performance.now();
    let parser = new GerberParser();
    parser.parseBlock(content);
    //let parseEnd = performance.now();
    let ctx = new GerberState();
    ctx.isOutlineMode = isOutline;
    parser.execute(ctx);
    if (!ctx.isDone) {
        ctx.endFile(new M02Command("M02"));
    }
    //let executeEnd = performance.now();
    let primitives = ctx.primitives;
    let objects:GraphicsObjects = [];
    let vertices = 0;
    if (primitives.length > 0) {
        primitives.forEach(p => {
            p.objects.forEach(object => {
                object.polySet.forEach(poly => vertices += poly.length)
            });
            objects.push(...p.objects);
        });
    }
    let image = composeSolidImage(objects, union);
    //let composeEnd = performance.now();
    let thins:PolygonSet = [];
    objects
        .filter(o => o.polarity == ObjectPolarity.THIN)
        .forEach(o => {
            thins.push(...o.polySet.filter(p => p.length > 2));
        });
    let bounds:SimpleBounds;
    if (image.bounds) {
        bounds = image.bounds;
    } else {
        bounds = {minx:0, miny:0, maxx:0, maxy : 0};
    }
    if (thins.length > 0) {
        let thinBounds = polySetBounds(thins);
        if (image.bounds)
            thinBounds.merge(image.bounds);
        bounds = thinBounds.toSimpleBounds();
    }
/*
    console.log('---');
    console.log(`Primitives   ${primitives.length}`);
    console.log(`Vertices     ${vertices}`);
    console.log(`Objects      ${objects.length}`);
    console.log(`Solid polys  ${solids.length}`);
    console.log(`Union        ${union}`);
    console.log(`Parse   Time ${parseEnd - start}ms`);
    console.log(`Execute Time ${executeEnd - parseEnd}ms`);
    console.log(`Compose Time ${composeEnd - executeEnd}ms`);
    console.log(`Total   Time ${performance.now() - start}ms`);
*/
    return {
        solids: image.polygonSet ? image.polygonSet : [],
        thins: connectWires(thins, tolerance),
        bounds: bounds,
        primitives: primitives
    };
}

export class PrimitiveConverter {
    public static GerberToPrimitives(content:string, isOutline:boolean = false):Array<GraphicsPrimitive> {
        let parser = new GerberParser();
        parser.parseBlock(content);
        let ctx = new GerberState();
        ctx.isOutlineMode = isOutline;
        parser.execute(ctx);
        return ctx.primitives;
    }
}

console.log(`GerberParser build ${Build}`);

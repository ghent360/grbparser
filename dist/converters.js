"use strict";
/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This file contains classes that convert graphics object primitives from the parset
 * to other formats for example - polygon sets, svg etc.
 */
const primitives_1 = require("./primitives");
const point_1 = require("./point");
const polygonSet_1 = require("./polygonSet");
const grbparser_1 = require("./grbparser");
class ConverterBase {
    convert(primitives) {
        let result = this.header(primitives);
        primitives.forEach(p => {
            if (p instanceof primitives_1.Line) {
                let line = p;
                result.push(this.convertLine(line));
            }
            else if (p instanceof primitives_1.Arc) {
                let arc = p;
                result.push(this.convertArc(arc));
            }
            else if (p instanceof primitives_1.Circle) {
                let circle = p;
                result.push(this.convertCircle(circle));
            }
            else if (p instanceof primitives_1.Flash) {
                let flash = p;
                result.push(this.convertFlash(flash));
            }
            else if (p instanceof primitives_1.Region) {
                let region = p;
                result.push(this.convertRegion(region));
            }
            else if (p instanceof primitives_1.Repeat) {
                let repeat = p;
                result.push(this.convertRepeat(repeat));
            }
            else {
                throw new Error("Unknown primitive " + p);
            }
        });
        return result.concat(this.footer(primitives));
    }
    header(primitives) {
        return [];
    }
    footer(primitives) {
        return [];
    }
}
exports.ConverterBase = ConverterBase;
class DebugConverter {
    convert(primitives) {
        let result = [];
        primitives.forEach(p => {
            result.push(p.toString());
        });
        return result;
    }
}
exports.DebugConverter = DebugConverter;
exports.Init = polygonSet_1.waitClipperLoad();
function WaitInit(callback) {
    Promise.resolve(polygonSet_1.waitClipperLoad()).then(() => callback());
}
exports.WaitInit = WaitInit;
class SVGConverter extends ConverterBase {
    constructor() {
        super(...arguments);
        this.scale = 100;
        this.margin = 10;
        this.layerColor = 0xff1f1c;
        this.precision = 3;
        this.objects_ = [];
    }
    convertLine(l) {
        this.objects_ = this.objects_.concat(l.objects);
        return "";
    }
    convertArc(a) {
        this.objects_ = this.objects_.concat(a.objects);
        return "";
    }
    convertCircle(c) {
        this.objects_ = this.objects_.concat(c.objects);
        return "";
    }
    convertFlash(f) {
        this.objects_ = this.objects_.concat(f.objects);
        return "";
    }
    convertRegion(r) {
        this.objects_ = this.objects_.concat(r.objects);
        return "";
    }
    convertRepeat(r) {
        this.objects_ = this.objects_.concat(r.objects);
        return "";
    }
    header(primitives) {
        this.bounds_ = primitives[0].bounds;
        primitives.forEach(p => this.bounds_.merge(p.bounds));
        this.width_ = this.bounds_.width * this.scale + this.margin * 2;
        this.height_ = this.bounds_.height * this.scale + this.margin * 2;
        this.offset_ = new point_1.Point(-this.bounds_.min.x * this.scale + this.margin, -this.bounds_.min.y * this.scale + this.margin);
        return ['<?xml version="1.0" standalone="no"?>',
            '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">',
            `<svg width="100%" height="100%" viewBox="0 0 ${this.width_} ${this.height_}"
                      version="1.1" xmlns="http://www.w3.org/2000/svg">`,
            /*`<rect x="${this.margin}" y="${this.margin}"
                   width="${bounds.width * this.scale}" height="${bounds.height * this.scale}"
                   stroke="green" stroke-width="1" fill="none"/>`,*/
            '<g stroke="black">'];
    }
    footer() {
        let wires = [];
        this.objects_
            .filter(o => o.polarity == primitives_1.ObjectPolarity.THIN)
            .forEach(p => wires = wires.concat(p.polySet));
        let solids = primitives_1.composeSolidImage(this.objects_, true);
        wires = polygonSet_1.connectWires(wires);
        //console.log(`Solids ${solids.length} wires ${wires.length}`);
        let svgSolids = this.polySetToSolidPath(solids);
        let svgWires = this.polySetToWirePath(wires);
        return [svgSolids, svgWires, "</g>", "</svg>"];
    }
    polySetToSolidPath(polySet) {
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
    polySetToWirePath(polySet) {
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
        result += `style="stroke:${SVGConverter.colorToHtml(this.layerColor)}; ` +
            'stroke-opacity:1; stroke-width:1;"/>\n';
        return result;
    }
    static toString2(n) {
        return ((n >>> 4) & 0xf).toString(16) +
            (n & 0xf).toString(16);
    }
    static colorToHtml(clr) {
        let ss;
        ss = '#' + SVGConverter.toString2((clr >>> 16) & 0xff)
            + SVGConverter.toString2((clr >>> 8) & 0xff)
            + SVGConverter.toString2(clr & 0xff);
        return ss;
    }
    static GerberToSvg(content, layerColor = 0xff1f1c, scale = 100, margin = 10) {
        let parser = new grbparser_1.GerberParser();
        parser.parseBlock(content);
        let ctx = new primitives_1.GerberState();
        parser.execute(ctx);
        let primitives = ctx.primitives;
        let cvt = new SVGConverter();
        cvt.layerColor = layerColor;
        cvt.scale = scale;
        cvt.margin = margin;
        let svg = cvt.convert(primitives);
        let result = "";
        svg.forEach(l => result = result.concat(l));
        return result;
    }
}
exports.SVGConverter = SVGConverter;
class PolygonConverter {
    constructor(solids, thins, bounds) {
        this.solids = solids;
        this.thins = thins;
        this.bounds = bounds;
    }
    static GerberToPolygons(content, union = true) {
        let parser = new grbparser_1.GerberParser();
        parser.parseBlock(content);
        let ctx = new primitives_1.GerberState();
        parser.execute(ctx);
        let primitives = ctx.primitives;
        let objects = [];
        let bounds = primitives[0].bounds;
        primitives.forEach(p => {
            objects = objects.concat(p.objects);
            bounds.merge(p.bounds);
        });
        let solids = primitives_1.composeSolidImage(objects, union);
        let thins = [];
        objects
            .filter(o => o.polarity == primitives_1.ObjectPolarity.THIN)
            .forEach(o => thins = thins.concat(o.polySet));
        return new PolygonConverter(solids, polygonSet_1.connectWires(thins), bounds);
    }
}
exports.PolygonConverter = PolygonConverter;
class PrimitiveConverter {
    static GerberToPrimitives(content) {
        let parser = new grbparser_1.GerberParser();
        parser.parseBlock(content);
        let ctx = new primitives_1.GerberState();
        parser.execute(ctx);
        return ctx.primitives;
    }
}
exports.PrimitiveConverter = PrimitiveConverter;
//# sourceMappingURL=converters.js.map
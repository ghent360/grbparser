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
function toString2(n) {
    return ((n >>> 4) & 0xf).toString(16) +
        (n & 0xf).toString(16);
}
function ColorToHtml(clr) {
    let ss;
    ss = '#' + toString2((clr >>> 16) & 0xff)
        + toString2((clr >>> 8) & 0xff)
        + toString2(clr & 0xff);
    return ss;
}
//------------------------------------------------------------------------------
function GetAlphaAsFrac(clr) {
    return ((clr >>> 24) & 0xff) / 255;
}
//a very simple class that builds an SVG file with any number of 
//polygons of the specified formats ...
class StyleInfo {
    constructor() {
        //this.pft = c.PolyFillType.pftNonZero;
        this.brushClr = 0xFFFFFFCC;
        this.penClr = 0xFF000000;
        this.penWidth = 0;
        this.showCoords = false;
    }
    Clone() {
        let si = new StyleInfo();
        si.brushClr = this.brushClr;
        si.penClr = this.penClr;
        si.penWidth = this.penWidth;
        si.showCoords = this.showCoords;
        return si;
    }
}
exports.StyleInfo = StyleInfo;
const svg_header = [
    "<?xml version=\"1.0\" standalone=\"no\"?>\n" +
        "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.0//EN\"\n" +
        "\"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\">\n\n" +
        "<svg width=\"",
    "\" height=\"",
    "\" viewBox=\"0 0 ",
    "\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\">\n\n"
];
const poly_end = [
    "\"\n style=\"fill:",
    "; fill-opacity:",
    "; fill-rule:",
    "; stroke:",
    "; stroke-opacity:",
    "; stroke-width:",
    ";\"/>\n\n"
];
class SVGBuilder {
    constructor() {
        this.PolyInfoList = new Array();
        this.style = new StyleInfo();
    }
    Add(poly) {
        if (poly.length == 0) {
            return;
        }
        this.PolyInfoList.push({ polygons: poly, si: this.style.Clone() });
    }
    SaveToSVG(file, scale = 1.0, margin = 10) {
        //calculate the bounding rect ...
        let i = 0;
        let j = 0;
        while (i < this.PolyInfoList.length) {
            j = 0;
            while (j < this.PolyInfoList[i].polygons.length &&
                this.PolyInfoList[i].polygons[j].length == 0) {
                j++;
            }
            if (j < this.PolyInfoList[i].polygons.length) {
                break;
            }
            i++;
        }
        if (i == this.PolyInfoList.length) {
            return false;
        }
        let left = this.PolyInfoList[i].polygons[j][0];
        let right = left;
        let top = this.PolyInfoList[i].polygons[j][1];
        let bottom = top;
        for (; i < this.PolyInfoList.length; ++i) {
            for (let j = 0; j < this.PolyInfoList[i].polygons.length; ++j) {
                for (let k = 0; k < this.PolyInfoList[i].polygons[j].length; k += 2) {
                    let ipx = this.PolyInfoList[i].polygons[j][k];
                    let ipy = this.PolyInfoList[i].polygons[j][k + 1];
                    if (ipx < left) {
                        left = ipx;
                    }
                    else if (ipx > right) {
                        right = ipx;
                    }
                    if (ipy < top) {
                        top = ipy;
                    }
                    else if (ipy > bottom) {
                        bottom = ipy;
                    }
                }
            }
        }
        if (scale == 0) {
            scale = 1.0;
        }
        if (margin < 0) {
            margin = 0;
        }
        let _left = left * scale;
        let _top = top * scale;
        let _right = right * scale;
        let _bottom = bottom * scale;
        let offsetX = -_left + margin;
        let offsetY = -_top + margin;
        file.write(svg_header[0]);
        file.write("100%");
        file.write(svg_header[1]);
        file.write("100%");
        file.write(svg_header[2]);
        file.write((_right - _left + margin * 2).toString());
        file.write(" ");
        file.write((_bottom - _top + margin * 2).toString());
        file.write(svg_header[3]);
        for (let i = 0; i < this.PolyInfoList.length; ++i) {
            file.write(" <path d=\"");
            for (let j = 0; j < this.PolyInfoList[i].polygons.length; ++j) {
                if (this.PolyInfoList[i].polygons[j].length < 3) {
                    continue;
                }
                file.write(" M ");
                file.write((this.PolyInfoList[i].polygons[j][0] * scale + offsetX).toFixed(3));
                file.write(" ");
                file.write((this.PolyInfoList[i].polygons[j][1] * scale + offsetY).toFixed(3));
                for (let k = 2; k < this.PolyInfoList[i].polygons[j].length; k += 2) {
                    let ipx = this.PolyInfoList[i].polygons[j][k];
                    let ipy = this.PolyInfoList[i].polygons[j][k + 1];
                    let x = ipx * scale;
                    let y = ipy * scale;
                    file.write(" L ");
                    file.write((x + offsetX).toFixed(3));
                    file.write(" ");
                    file.write((y + offsetY).toFixed(3));
                }
                file.write(" z");
            }
            file.write(poly_end[0]);
            file.write(ColorToHtml(this.PolyInfoList[i].si.brushClr));
            file.write(poly_end[1]);
            file.write(GetAlphaAsFrac(this.PolyInfoList[i].si.brushClr).toString());
            file.write(poly_end[2]);
            file.write("nonzero"); // "evenodd"
            file.write(poly_end[3]);
            file.write(ColorToHtml(this.PolyInfoList[i].si.penClr));
            file.write(poly_end[4]);
            file.write(GetAlphaAsFrac(this.PolyInfoList[i].si.penClr).toString());
            file.write(poly_end[5]);
            file.write(this.PolyInfoList[i].si.penWidth.toString());
            file.write(poly_end[6]);
            if (this.PolyInfoList[i].si.showCoords) {
                file.write("<g font-family=\"Verdana\" font-size=\"11\" fill=\"black\">\n\n");
                for (let j = 0; j < this.PolyInfoList[i].polygons.length; ++j) {
                    if (this.PolyInfoList[i].polygons[j].length < 3) {
                        continue;
                    }
                    for (let k = 0; k < this.PolyInfoList[i].polygons[j].length; k += 2) {
                        let ipx = this.PolyInfoList[i].polygons[j][k];
                        let ipy = this.PolyInfoList[i].polygons[j][k + 1];
                        file.write("<text x=\"");
                        file.write(Math.trunc(ipx * scale + offsetX).toString());
                        file.write("\" y=\"");
                        file.write(Math.trunc(ipy * scale + offsetY).toString());
                        file.write("\">");
                        file.write(ipx.toFixed(3));
                        file.write(",");
                        file.write(ipy.toFixed(3));
                        file.write("</text>\n\n");
                    }
                }
                file.write("</g>\n");
            }
        }
        file.write("</svg>\n");
        return true;
    }
}
exports.SVGBuilder = SVGBuilder;
//# sourceMappingURL=svgbuilder.js.map
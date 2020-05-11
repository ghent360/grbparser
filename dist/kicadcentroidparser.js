"use strict";
/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2020
 *
 * License: MIT License, see LICENSE.txt
 */
Object.defineProperty(exports, "__esModule", { value: true });
const primitives_1 = require("./primitives");
const point_1 = require("./point");
const gerberutils_1 = require("./gerberutils");
const csv = require("csv-parse");
class KicadCentroidParseException {
    constructor(message, line) {
        this.message = message;
        this.line = line;
    }
    toString() {
        if (this.line != undefined) {
            return `Error parsing KiCad position file at line ${this.line}: ${this.message}`;
        }
        return `Error parsing KiCad position file: ${this.message}`;
    }
}
exports.KicadCentroidParseException = KicadCentroidParseException;
class ComponentPositionImpl {
    constructor() {
        this.name = "";
        this.center = new point_1.Point();
        this.rotation = 0;
        this.layer = gerberutils_1.BoardSide.Unknown;
        this.attributes = [];
    }
    formatOutput(nameIdx = 0, xPosIdx = 3, rotationIdx = 4, layerIdx = 5) {
        let maxIdx = Math.max(nameIdx, xPosIdx + 1, rotationIdx, layerIdx, this.attributes.length - 1);
        let result = "";
        for (let idx = 0; idx <= maxIdx; idx++) {
            if (idx > 0) {
                result += ",";
            }
            switch (idx) {
                case nameIdx:
                    result += this.name;
                    break;
                case xPosIdx:
                    result += this.center.x;
                    break;
                case xPosIdx + 1:
                    result += this.center.y;
                    break;
                case rotationIdx:
                    result += this.rotation;
                    break;
                case layerIdx:
                    result += ComponentPositionImpl.toBoardSide(this.layer);
                    break;
                default:
                    if (idx < this.attributes.length && this.attributes[idx]) {
                        result += this.attributes[idx];
                    }
                    break;
            }
        }
        return result;
    }
    static toBoardSide(element) {
        switch (element) {
            case gerberutils_1.BoardSide.Top: return "top";
            case gerberutils_1.BoardSide.Bottom: return "bottom";
        }
        return "unknown";
    }
}
const kDesignator = "Designator";
const kMidX = "MidX";
const kRotation = "Rotation";
const kLayer = "Layer";
/**
 * The main Kicad centroid parser class.
 *
 * Usage TBD.
 */
class KicadCentroidParser {
    constructor() {
        this.csvParser = new csv.Parser({
            skip_empty_lines: true
        });
        this.header = undefined;
        this.nameIdx = -1;
        this.xPosIdx = -1;
        this.rotationIdx = -1;
        this.layerIdx = -1;
        this.components = [];
        this.csvParser.on("readable", () => {
            let record;
            while (record = this.csvParser.read()) {
                this.processRecord(record);
            }
        });
        this.csvParser.on("error", (err) => {
            console.error(err.message);
        });
    }
    parseBlock(block) {
        this.csvParser.write(block);
    }
    flush() {
        this.csvParser.end();
        this.calcBounds();
    }
    result() {
        let side = gerberutils_1.BoardSide.Unknown;
        if (this.components.length > 0) {
            side = this.components[0].layer;
        }
        for (let idx = 1; idx < this.components.length; idx++) {
            if (this.components[idx].layer != side) {
                side = gerberutils_1.BoardSide.Both;
                break;
            }
        }
        let bounds = this.bounds;
        if (!bounds) {
            bounds = { minx: 0, miny: 0, maxx: 0, maxy: 0 };
        }
        return { components: this.components, bounds: bounds, side: side };
    }
    processRecord(record) {
        if (!this.header) {
            this.header = record;
            this.processHeader(this.header);
            return;
        }
        let cp = new ComponentPositionImpl();
        record.forEach((elm, idx) => {
            elm = elm.trim();
            switch (idx) {
                case this.nameIdx:
                    cp.name = elm;
                    break;
                case this.xPosIdx:
                    cp.center.x = Number.parseFloat(elm);
                    break;
                case this.xPosIdx + 1:
                    cp.center.y = Number.parseFloat(elm);
                    break;
                case this.rotationIdx:
                    cp.rotation = Number.parseFloat(elm);
                    break;
                case this.layerIdx:
                    cp.layer = KicadCentroidParser.toBoardSide(elm);
                    break;
                default:
                    cp.attributes[idx] = elm;
                    break;
            }
        });
        this.components.push(cp);
    }
    static toBoardSide(element) {
        switch (element) {
            case "top": return gerberutils_1.BoardSide.Top;
            case "bottom": return gerberutils_1.BoardSide.Bottom;
        }
        return gerberutils_1.BoardSide.Unknown;
    }
    processHeader(header) {
        this.nameIdx = header.indexOf("Designator");
        if (this.nameIdx < 0)
            this.nameIdx = header.indexOf("Ref");
        this.xPosIdx = header.indexOf("MidX");
        if (this.xPosIdx < 0)
            this.xPosIdx = header.indexOf("PosX");
        this.rotationIdx = header.indexOf("Rotation");
        if (this.rotationIdx < 0)
            this.rotationIdx = header.indexOf("Rot");
        this.layerIdx = header.indexOf("Layer");
        if (this.layerIdx < 0)
            this.layerIdx = header.indexOf("Side");
    }
    calcBounds() {
        if (this.components.length < 1) {
            return;
        }
        let bounds = new primitives_1.Bounds(this.components[0].center.clone(), this.components[0].center.clone());
        this.components.forEach(cmp => bounds.merge(cmp.center));
        this.bounds = bounds.toSimpleBounds();
    }
    output() {
        let result = "";
        return result;
    }
}
exports.KicadCentroidParser = KicadCentroidParser;
//# sourceMappingURL=kicadcentroidparser.js.map
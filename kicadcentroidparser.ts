/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2020
 * 
 * License: MIT License, see LICENSE.txt
 */

import {SimpleBounds, Bounds} from "./primitives";
import { Point } from "./point";
import { BoardSide, BoardLayer } from "./gerberutils";
import * as csv from "csv-parse";

export class KicadCentroidParseException {
    constructor(readonly message:string, readonly line?:number) {
    }

    toString():string {
        if (this.line != undefined) {
            return `Error parsing KiCad position file at line ${this.line}: ${this.message}`;
        }
        return `Error parsing KiCad position file: ${this.message}`;
    }
}

export interface ComponentPosition {
    readonly name:string;
    readonly center:Point;
    readonly rotation:number;
    readonly layer:BoardSide;
    readonly attributes:ReadonlyArray<string>;
    formatOutput():string;
}

class ComponentPositionImpl {
    name:string;
    center:Point = new Point();
    rotation:number;
    layer:BoardSide;
    attributes:Array<string> = [];

    public formatOutput(
        nameIdx = 0,
        xPosIdx = 3,
        rotationIdx = 4,
        layerIdx = 5):string {
        let maxIdx = Math.max(
            nameIdx,
            xPosIdx + 1,
            rotationIdx,
            layerIdx,
            this.attributes.length - 1);
        let result = "";
        for (let idx = 0; idx <= maxIdx; idx++) {
            if (idx > 0) {
                result += ",";
            }
            switch(idx) {
                case nameIdx: result += this.name;break;
                case xPosIdx: result += this.center.x;break;
                case xPosIdx + 1: result += this.center.y;break;
                case rotationIdx: result += this.rotation;break;
                case layerIdx: result += ComponentPositionImpl.toBoardSide(this.layer); break;
                default:
                    if (idx < this.attributes.length && this.attributes[idx]) {
                        result += this.attributes[idx];
                    }
                    break;
            }
        }
        return result;
    }

    private static toBoardSide(element:BoardSide):string {
        switch (element) {
            case BoardSide.Top: return "top";
            case BoardSide.Bottom: return "bottom";
        }
        return "unknown";
    }
}

export interface KicadCentroidParserResult {
    components:Array<ComponentPosition>;
    bounds:SimpleBounds;
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
export class KicadCentroidParser {
    private csvParser:csv.Parser = new csv.Parser({
        delimiter:',',
        skip_empty_lines: true
    });

    private header:Array<string> = null;
    private nameIdx = -1;
    private xPosIdx = -1;
    private rotationIdx = -1;
    private layerIdx = -1;
    private components:Array<ComponentPosition> = [];
    private bounds:SimpleBounds;

    constructor() {
        this.csvParser.on("readable", () => {
            let record:Array<string>;
            while (record = this.csvParser.read()) {
                this.processRecord(record);
            }
        });
        this.csvParser.on("error", (err:Error) => {
            console.error(err.message);
        });
    }

    parseBlock(block:string) {
        this.csvParser.write(block);
    }

    flush() {
        this.csvParser.end();
        this.calcBounds();
    }

    result() {
        let side = BoardSide.Unknown;
        if (this.components.length > 0) {
            side = this.components[0].layer;
        }
        for (let idx = 1; idx < this.components.length; idx++) {
            if (this.components[idx].layer != side) {
                side = BoardSide.Both;
                break;
            }
        }
        return {components:this.components, bounds:this.bounds, side:side};
    }

    private processRecord(record:any):void {
        if (!this.header) {
            this.header = record as Array<string>;
            this.processHeader();
            return;
        }
        let cp = new ComponentPositionImpl();
        record.forEach((elm, idx) => {
            switch(idx) {
                case this.nameIdx: cp.name = elm; break;
                case this.xPosIdx: cp.center.x = Number.parseFloat(elm); break;
                case this.xPosIdx+1: cp.center.y = Number.parseFloat(elm); break;
                case this.rotationIdx: cp.rotation = Number.parseFloat(elm); break;
                case this.layerIdx: cp.layer = KicadCentroidParser.toBoardSide(elm); break;
                default: cp.attributes[idx] = elm; break
            }
        });
        this.components.push(cp);
    }

    private static toBoardSide(element:string):BoardSide {
        switch (element) {
            case "top": return BoardSide.Top;
            case "bottom": return BoardSide.Bottom;
        }
        return BoardSide.Unknown;
    }

    private processHeader():void {
        this.nameIdx = this.header.indexOf("Designator");
        if (this.nameIdx < 0) this.nameIdx = this.header.indexOf("Ref");
        this.xPosIdx = this.header.indexOf("MidX");
        if (this.xPosIdx < 0) this.xPosIdx = this.header.indexOf("PosX");
        this.rotationIdx = this.header.indexOf("Rotation");
        if (this.rotationIdx < 0) this.rotationIdx = this.header.indexOf("Rot");
        this.layerIdx = this.header.indexOf("Layer");
        if (this.layerIdx < 0) this.layerIdx = this.header.indexOf("Side");
    }

    private calcBounds() {
        if (this.components.length < 1) {
            return;
        }
        let bounds = new Bounds(this.components[0].center, this.components[0].center);
        this.components.forEach(cmp => bounds.merge(cmp.center));
        this.bounds = bounds.toSimpleBounds();
    }

    public output():string {
        let result = "";
        return result;
    }
}

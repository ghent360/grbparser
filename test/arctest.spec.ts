/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2018
 * 
 * License: MIT License, see LICENSE.txt
 */

import * as assert from 'assert';
import * as fs from 'fs';
import { Point } from '../point';
import { SVGConverter, Init } from '../converters';

const hdr = 
    "G04 --*\n" +
    "%MOIN*%\n" +
    "%FSLAX33Y33*%\n" +
    "%ADD11C,1.2*%\n" +
    "%ADD12C,0.1*%\n" +
    "D11*\n" +
    "G75*\n";

const ftr = 
    "M02*";

function formatFixed(n:number, prec:number):string {
    let r = n * Math.pow(10, prec);
    return Math.round(r).toString();
}

function moveCommand(dest:Point):string {
    return `X${formatFixed(dest.x, 3)}Y${formatFixed(dest.y, 3)}D02*\n`;
}

function arcCommand(start:Point, end:Point, center:Point, cw:boolean):string {
    let result = "G01*\n";
    result += moveCommand(start);
    result += (cw) ? "G02*" : "G03*";
    result += "\n";
    result += `X${formatFixed(end.x, 3)}Y${formatFixed(end.y, 3)}`;
    result += `I${formatFixed(center.x - start.x, 3)}J${formatFixed(center.y - start.y, 3)}D01*\n`;
    return result;
}

function arc(center:Point, radius:number, startAngle:number, endAngle:number, cw:boolean):string {
    let startAngleR = startAngle * Math.PI / 180;
    let startx = center.x + radius * Math.cos(startAngleR);
    let starty = center.y + radius * Math.sin(startAngleR);
    let endAngleR = endAngle * Math.PI / 180;
    let endx = center.x + radius * Math.cos(endAngleR);
    let endy = center.y + radius * Math.sin(endAngleR);
    return arcCommand(new Point(startx, starty), new Point(endx, endy), center, cw);
}

function line(from:Point, to:Point):string {
    return "G01*\n" +
        moveCommand(from) +
        `X${formatFixed(to.x, 3)}Y${formatFixed(to.y, 3)}D01*\n`;
}

function saveContent(content:string, fileName:string) {
    let stream = fs.createWriteStream(fileName);
    stream.write(content);
    stream.end();
}

describe("Arc tests", () => {
    it('Wait to init', () => Init);
    it('CCW single quadrant test', () => {
        let content = hdr;
        for (let idx = 0; idx < 11; idx++) {
            content += arc(new Point(0, 0), 5 + idx, idx * 2, idx * 8 + 2, false);
        }
        content += "D12*\n";
        content += line(new Point(20, 10), new Point (0, 0));
        content += ftr;
        let result = SVGConverter.GerberToSvg(content, 0x101010, 1000, 0);
        saveContent(content, "arcTests/ccw.gbr");
        saveContent(result, "arcTests/ccw.svg");
    });
    it('CW single quadrant test', () => {
        let content = hdr;
        for (let idx = 0; idx < 11; idx++) {
            content += arc(new Point(0, 0), 5 + idx, -idx * 2, -idx * 8 - 2, true);
        }
        content += "D12*\n";
        content += line(new Point(20, -10), new Point (0, 0));
        content += ftr;
        let result = SVGConverter.GerberToSvg(content, 0x101010, 1000, 0);
        saveContent(content, "arcTests/cw.gbr");
        saveContent(result, "arcTests/cw.svg");
    });
});
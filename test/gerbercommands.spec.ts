/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

import * as assert from 'assert';
import * as cm from '../gerbercommands';
import * as pr from '../primitives';
import { CoordinateType, CoordinateZeroFormat, GerberParseException } from '../primitives';

describe("Commands tests", () => {
    it('FS Command', () => {
        let cmd = new cm.FSCommand("FSLAX26Y37*");
        assert.equal(cmd.coordinateFormat.xNumIntPos, 2);
        assert.equal(cmd.coordinateFormat.xNumDecPos, 6);
        assert.equal(cmd.coordinateFormat.yNumIntPos, 3);
        assert.equal(cmd.coordinateFormat.yNumDecPos, 7);
        assert.deepEqual(cmd.formatOutput(), "FSLAX26Y37*")
    });
    it('G04 Command', () => {
        let cmd = new cm.G04Command("G4");
        assert.equal(cmd.comment, "");
        assert.deepEqual(cmd.formatOutput(), "G04")
        cmd = new cm.G04Command("G000004 Create aperture macro");
        assert.equal(cmd.comment, " Create aperture macro");
        assert.deepEqual(cmd.formatOutput(), "G04 Create aperture macro")
    });
    it('MO Command', () => {
        let cmd = new cm.MOCommand("MOIN*");
        assert.equal(cmd.units, pr.CoordinateUnits.INCHES);
        assert.deepEqual(cmd.formatOutput(), "MOIN*");
        cmd = new cm.MOCommand("MOMM*");
        assert.equal(cmd.units, pr.CoordinateUnits.MILIMETERS);
        assert.deepEqual(cmd.formatOutput(), "MOMM*");
    });
    it('AD Command', () => {
        let cmd = new cm.ADCommand("ADD10Test*");
        let out = cmd.formatOutput();
        assert.equal(cmd.definition.apertureId, 10);
        assert.equal(cmd.definition.templateName, "Test");
        assert.equal(cmd.definition.modifiers.length, 0);
        assert.equal(out, "ADD10Test*");

        cmd = new cm.ADCommand("ADD11C,0.555X0.123*");
        out = cmd.formatOutput();
        assert.equal(cmd.definition.apertureId, 11);
        assert.equal(cmd.definition.templateName, "C");
        assert.equal(cmd.definition.modifiers.length, 2);
        assert.equal(cmd.definition.modifiers[0], 0.555);
        assert.equal(cmd.definition.modifiers[1], 0.123);
        assert.equal(out, "ADD11C,0.555X0.123*");

        cmd = new cm.ADCommand("ADD10C, 0.0100*");
        out = cmd.formatOutput();
        assert.equal(cmd.definition.modifiers.length, 1);
        assert.equal(cmd.definition.modifiers[0], 0.01);
        assert.equal(out, "ADD10C,0.01*");

        cmd = new cm.ADCommand("ADD10C,2.3622e-06*");
        out = cmd.formatOutput();
        assert.equal(cmd.definition.modifiers.length, 1);
        assert.equal(cmd.definition.modifiers[0], 0.0000023622);
        assert.equal(out, "ADD10C,0.0000023622*");

        assert.throws(() => new cm.ADCommand("ADD05C,0.5*"), GerberParseException);
    });
    it('AM Command', () => {
        let cmd = new cm.AMCommand("AMTest*$1=555*$2=$1 + 2*");
        assert.equal(cmd.macro.macroName, "Test");
        assert.equal(cmd.macro.content.length, 2);
        let testCmd = "AMRECTROUNDCORNERS*"
        + "0 Rectangle with rounded corners*"
        + "0 $1 width *"
        + "0 $2 height *"
        + "0 $3 corner radius *"
        + "0 $4 flash origin X offset *"
        + "0 $5 flash origin Y offset *"
        + "0 $6 rotation angle *"
        + "0 Create two overlapping rectangles that omit the rounded corner areas*"
        + "20,1,$2-2x$3,$4-$1/2,$5,$4+$1/2,$5,$6*"
        + "20,1,$2,$4,$5-$2/2,$4,$5+$2/2,$6*"
        + "0 Add circles at the corners. *"
        + "1,1,2x$3,$4+$1/2-$3,$5+$2/2-$3,$6*"
        + "1,1,2x$3,$4-$1/2+$3,$5+$2/2-$3,$6*"
        + "1,1,2x$3,$4-$1/2+$3,$5-$2/2+$3,$6*"
        + "1,1,2x$3,$4+$1/2-$3,$5-$2/2+$3,$6*";
        cmd = new cm.AMCommand(testCmd);
        let out = cmd.formatOutput();
        assert.equal(out.replace(/\n/g, ""), testCmd);
        cmd = new cm.AMCommand(
                "AMROUNDEDRECTD42*"
            + "21,1,0.0335,0.0000,0,0,180.0*"
            + "1,1,0.0177,-0.0079,0.0000*"
            + "1,1,0.0177,0.0079,0.0000*"
            + "1,1,0.0177,0.0079,0.0000*"
            + "1,1,0.0177,-0.0079,0.0000*");
        out = cmd.formatOutput();
    });
    it('Dxx Command', () => {
        let cmd = new cm.DCommand("D15");
        assert.equal(cmd.apertureId, 15);
        assert.equal(cmd.formatOutput(), "D15");
        assert.throws(() => new cm.DCommand("D05"), GerberParseException);
    });
    it('D0x Command', () => {
        let cmd:cm.D01Command|cm.D02Command|cm.D03Command;

        let fmt = new pr.CoordinateFormatSpec(CoordinateZeroFormat.LEADING, CoordinateType.ABSOLUTE, 1, 3, 1, 3);

        cmd = new cm.D01Command("X2222", fmt);
        assert.equal(cmd.x, 2.222);
        let out = cmd.formatOutput(fmt);
        assert.equal(out, "X2222D01");
        cmd = new cm.D01Command("X0005Y1111D1", fmt);
        assert.equal(cmd.x, 0.005);
        assert.equal(cmd.y, 1.111);
        assert.equal(cmd.i, undefined);
        assert.equal(cmd.j, undefined);

        out = cmd.formatOutput(fmt);
        assert.equal(out, "X5Y1111D01");
        
        cmd = new cm.D02Command("X0Y0D2", fmt);
        assert.equal(cmd.x, 0);
        assert.equal(cmd.y, 0);
        out = cmd.formatOutput(fmt);
        assert.equal(out, "X0Y0D02");

        cmd = new cm.D03Command("D3", fmt);
        assert.equal(cmd.x, undefined);
        assert.equal(cmd.y, undefined);
        out = cmd.formatOutput(fmt);
        assert.equal(out, "D03");

        cmd = new cm.D02Command("Y1000D0002", fmt);
        assert.equal(cmd.x, undefined);
        assert.equal(cmd.y, 1);
    });
    it("Gxx codes", () => {
        let cmd:pr.GerberCommand = new cm.G01Command("G1");
        assert.throws(() => new cm.G01Command("G02"), GerberParseException);
        cmd = new cm.G02Command("G002");
        cmd = new cm.G03Command("G03");
        cmd = new cm.G74Command("G74");
        cmd = new cm.G75Command("G75");
    });
    it("Arc commands", () => {
        let fmt = new pr.CoordinateFormatSpec(CoordinateZeroFormat.LEADING, CoordinateType.ABSOLUTE, 2, 3, 2, 3);
        // Arc to 7.071, 7.071 center offset -10, 0
        let cmd = new cm.D01Command("X7071Y7071I-10000J0D01", fmt);
        let ctx = new pr.GerberState();
        ctx.coordinateUnits = pr.CoordinateUnits.INCHES;
        // Aperture circle 1 unit diameter
        ctx.setAperture(new pr.ApertureDefinition(10, "C", [1]));
        ctx.currentAppretureId = 10;
        // Arc center at 0, 0
        ctx.currentPointX = 10;
        ctx.currentPointY = 0;
        ctx.interpolationMode = pr.InterpolationMode.CLOCKWISE;
        ctx.quadrantMode = pr.QuadrantMode.MULTI;
        cmd.execute(ctx);
        let primitives = (ctx.graphicsOperations as pr.BaseGraphicsOperationsConsumer).primitives;
        assert.equal(primitives.length, 1);
        //console.log(`arc: ${primitives[0]}`);
    });
});

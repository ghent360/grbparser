import { GerberParseException, GerberState } from '../primitives';
import { AMCommand, D01Command, D02Command, D03Command, DCommand } from '../commands';
import * as assert from 'assert';
import * as fs from 'fs';
import * as cm from '../commands';
import * as pr from '../primitives';

describe("Commands tests", () => {
    it('FS Command', () => {
        let state = new pr.GerberState();
        let cmd = new cm.FSCommand("FSLAX26Y37*", state);
        assert.equal(cmd.coordinateFormat.xNumIntPos, 2);
        assert.equal(cmd.coordinateFormat.xNumDecPos, 6);
        assert.equal(cmd.coordinateFormat.yNumIntPos, 3);
        assert.equal(cmd.coordinateFormat.yNumDecPos, 7);
        assert.deepEqual(cmd.formatOutput(), "%FSLAX26Y37*%")
    });
    it('G04 Command', () => {
        let cmd = new cm.G04Command("G4*");
        assert.equal(cmd.comment, "");
        assert.deepEqual(cmd.formatOutput(), "G04*")
        cmd = new cm.G04Command("G000004 Create aperture macro*");
        assert.equal(cmd.comment, " Create aperture macro");
        assert.deepEqual(cmd.formatOutput(), "G04 Create aperture macro*")
    });
    it('MO Command', () => {
        let state = new pr.GerberState();
        let cmd = new cm.MOCommand("MOIN*", state);
        assert.equal(cmd.units, pr.FileUnits.INCHES);
        assert.deepEqual(cmd.formatOutput(), "%MOIN*%")
        cmd = new cm.MOCommand("MOMM*", state);
        assert.equal(cmd.units, pr.FileUnits.MILIMETERS);
        assert.deepEqual(cmd.formatOutput(), "%MOMM*%")
    });
    it('AD Command', () => {
        let cmd = new cm.ADCommand("ADD10Test*");
        let out = cmd.formatOutput();
        assert.equal(cmd.definition.apertureId, 10);
        assert.equal(cmd.definition.templateName, "Test");
        assert.equal(cmd.definition.modifiers.length, 0);
        assert.equal(out, "%ADD10Test*%");

        cmd = new cm.ADCommand("ADD10C,0.555X0.123*");
        out = cmd.formatOutput();
        assert.equal(cmd.definition.apertureId, 10);
        assert.equal(cmd.definition.templateName, "C");
        assert.equal(cmd.definition.modifiers.length, 2);
        assert.equal(cmd.definition.modifiers[0], 0.555);
        assert.equal(cmd.definition.modifiers[1], 0.123);
        assert.equal(out, "%ADD10C,0.555X0.123*%");

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
        assert.equal(out.substring(1, out.length - 1).replace(/\n/g, ""), testCmd);
    });
    it('Dxx Command', () => {
        let cmd = new cm.DCommand("D15*");
        assert.equal(cmd.apertureId, 15);
        assert.equal(cmd.formatOutput(), "D15*");
        assert.throws(() => new cm.DCommand("D05*"), GerberParseException);
    });
    it('D0x Command', () => {
        let state = new pr.GerberState();
        let cmd:cm.D01Command|cm.D02Command|cm.D03Command;

        state.coordinateFormatSpec = new pr.CoordinateFormatSpec(1, 3, 1, 3);
        state.interpolationMode = pr.InterpolationMode.LINEAR;

        cmd = new cm.D01Command("X0005Y1111D1*", state);
        assert.equal(cmd.x, 0.005);
        assert.equal(cmd.y, 1.111);
        assert.equal(cmd.targetX, 0.005);
        assert.equal(cmd.targetY, 1.111);
        assert.equal(cmd.i, undefined);
        assert.equal(cmd.j, undefined);

        let out = cmd.formatOutput(state);
        assert.equal(out, "X5Y1111D01*");
        
        cmd = new cm.D02Command("X0Y0D2*", state);
        assert.equal(state.currentPointX, 0);
        assert.equal(state.currentPointY, 0);
        assert.equal(cmd.x, 0);
        assert.equal(cmd.y, 0);
        assert.equal(cmd.targetX, 0);
        assert.equal(cmd.targetY, 0);
        out = cmd.formatOutput(state);
        assert.equal(out, "X0Y0D02*");

        cmd = new cm.D03Command("D3*", state);
        assert.equal(cmd.targetX, 0);
        assert.equal(cmd.targetY, 0);
        assert.equal(cmd.x, undefined);
        assert.equal(cmd.y, undefined);
        out = cmd.formatOutput(state);
        assert.equal(out, "D03*");

        cmd = new cm.D02Command("Y1000D0002*", state);
        assert.equal(cmd.targetX, 0);
        assert.equal(cmd.targetY, 1);
        assert.equal(cmd.x, undefined);
        assert.equal(cmd.y, 1);
        assert.equal(state.currentPointX, 0);
        assert.equal(state.currentPointY, 1);

        cmd = new cm.D03Command("D3*", state);
        assert.equal(cmd.targetX, 0);
        assert.equal(cmd.targetY, 1);

        cmd = new cm.D02Command("X5000Y2000D02*", state);
        assert.equal(state.currentPointX, 5);
        assert.equal(state.currentPointY, 2);

        cmd = new cm.D01Command("X1000D01*", state);
        assert.equal(cmd.targetX, 1);
        assert.equal(cmd.targetY, 2);

        cmd = new cm.D01Command("Y1000D01*", state);
        assert.equal(cmd.targetX, 5);
        assert.equal(cmd.targetY, 1);

        cmd = new cm.D01Command("D01*", state);
        assert.equal(cmd.targetX, 5);
        assert.equal(cmd.targetY, 2);
    });
    it("Gxx codes", () => {
        let state = new pr.GerberState();
        let cmd:cm.GerberCommand = new cm.G01Command("G1*", state);
        assert.equal(state.interpolationMode, pr.InterpolationMode.LINEAR);
        assert.throws(() => new cm.G01Command("G02*", state), GerberParseException);
        cmd = new cm.G02Command("G002*", state);
        assert.equal(state.interpolationMode, pr.InterpolationMode.CLOCKWISE);
        cmd = new cm.G03Command("G03*", state);
        assert.equal(state.interpolationMode, pr.InterpolationMode.COUNTER_CLOCKWISE);
        cmd = new cm.G74Command("G74*", state);
        assert.equal(state.quadrantMode, pr.QuadrantMode.SINGLE);
        cmd = new cm.G75Command("G75*", state);
        assert.equal(state.quadrantMode, pr.QuadrantMode.MULTI);
    });
    it("Lx commands");
});

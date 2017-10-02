import { GerberState } from '../primitives';
import { AMCommand, DCommand } from '../commands';
import * as assert from 'assert';
import * as fs from 'fs';
import * as cm from '../commands';
import * as pr from '../primitives';

describe("Commands tests", () => {
    it('FS Command', () => {
        let cmd = new cm.FSCommand("FSLAX26Y37*");
        assert.equal(cmd.coordinateFormat.xNumIntPos, 2);
        assert.equal(cmd.coordinateFormat.xNumDecPos, 6);
        assert.equal(cmd.coordinateFormat.yNumIntPos, 3);
        assert.equal(cmd.coordinateFormat.yNumDecPos, 7);
        assert.deepEqual(cmd.formatOutput(), "%FSLAX26Y37*%")
    });
    it('G04 Command', () => {
        let cmd = new cm.G04Command("G4");
        assert.equal(cmd.comment, "");
        assert.deepEqual(cmd.formatOutput(), "G04*")
        cmd = new cm.G04Command("G000004 Create aperture macro");
        assert.equal(cmd.comment, " Create aperture macro");
        assert.deepEqual(cmd.formatOutput(), "G04 Create aperture macro*")
    });
    it('MO Command', () => {
        let cmd = new cm.MOCommand("MOIN*");
        assert.equal(cmd.units, pr.FileUnits.INCHES);
        assert.deepEqual(cmd.formatOutput(), "%MOIN*%")
        cmd = new cm.MOCommand("MOMM*");
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
    });
    it('D01 Command', () => {
        let state = new pr.GerberState();
        state.coordinateFormatSpec = new pr.CoordinateFormatSpec(1, 3, 1, 3);
        let cmd = new cm.D01Command("X0005D15*", state);
    });
});

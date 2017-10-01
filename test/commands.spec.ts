import * as assert from 'assert';
import * as fs from 'fs';
import * as cm from '../commands';
import * as pr from "../primitives";

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
    });
});

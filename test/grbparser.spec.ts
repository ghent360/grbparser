import * as assert from 'assert';
import * as fs from 'fs';
import * as gp from '../grbparser';

describe("GerberParser tests", () => {
    it('G01', () => {
        let commands:string[] = [];
        let cmdParser = new gp.CommandParser();
        cmdParser.setConsumer((cmd) => commands.push(cmd));
        cmdParser.parseBlock("G01");
        assert.equal(commands.length, 0);
        cmdParser.parseBlock("\n\r");
        assert.equal(commands.length, 0);
        cmdParser.parseBlock("X1234Y5678D02*");
        assert.equal(commands.length, 1);
        assert.equal(commands[0], "G01X1234Y5678D02");
    });
    it ('Simple extended commands', () => {
        let commands:string[] = [];
        let cmdParser = new gp.CommandParser();
        cmdParser.setConsumer((cmd) => commands.push(cmd));
        cmdParser.parseBlock(`G04 Generated by UcamX v2017.04-170404 on 2017.4.7*
%TF.GenerationSoftware,Ucamco,UcamX v2017.04-170404*%
%FSLAX26Y26*%
%MOIN*%`);

        assert.equal(commands.length, 4);
        assert.equal(commands[0], "G04 Generated by UcamX v2017.04-170404 on 2017.4.7");
        assert.equal(commands[1], "TF.GenerationSoftware,Ucamco,UcamX v2017.04-170404*");
        assert.equal(commands[2], "FSLAX26Y26*");
        assert.equal(commands[3], "MOIN*");
    });
    it('Complex extended commands', () => {
        let commands:string[] = [];
        let cmdParser = new gp.CommandParser();
        cmdParser.setConsumer((cmd) => commands.push(cmd));
        cmdParser.parseBlock(`G04 Create aperture macro*
%AMRECTROUNDCORNERS*
0 Rectangle with rounded corners*
0 $1 width *
0 $2 height *
0 $3 corner radius *
0 $4 flash origin X offset *
0 $5 flash origin Y offset *
0 $6 rotation angle *
0 Create two overlapping rectangles that omit the rounded corner areas*
20,1,$2-2x$3,$4-$1/2,$5,$4+$1/2,$5,$6*
20,1,$2,$4,$5-$2/2,$4,$5+$2/2,$6*
0 Add circles at the corners. *
1,1,2x$3,$4+$1/2-$3,$5+$2/2-$3,$6*
1,1,2x$3,$4-$1/2+$3,$5+$2/2-$3,$6*
1,1,2x$3,$4-$1/2+$3,$5-$2/2+$3,$6*
1,1,2x$3,$4+$1/2-$3,$5-$2/2+$3,$6*%
G04 Create aperture*
%ADD10RECTROUNDCORNERS,4X3X0.5X0X0X0*%`);        
        assert.equal(commands.length, 4);
        assert.equal(commands[0], "G04 Create aperture macro");
        assert.equal(commands[2], "G04 Create aperture");
        assert.equal(commands[3], "ADD10RECTROUNDCORNERS,4X3X0.5X0X0X0*");
    });
    it('parse gerber file', () => {
        let folder = "test/Gerber_File_Format_Examples";
        fs.readdirSync(folder)
            .filter(fileName => fileName.indexOf(".gbr") >= 0)
            .forEach(fileName => {
                let fullFileName = folder + "/" + fileName;
                let content = fs.readFileSync(fullFileName).toString();
                let parser = new gp.GerberParser();
                console.log(`Parsing ${fullFileName}`);
                parser.parseBlock(content);
            });
    });
});

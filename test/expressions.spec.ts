import * as assert from 'assert';
import {Memory, AritmeticOperation, ExpressionParser} from "../expressions";

describe("Expression tests", () => {
    it('Primitive expressions', () => {
        let parser = new ExpressionParser("$4+5-$7x3");
        let result = parser.parse();
        let memory = new Memory();
        memory.init([0, 0, 0, 5, 0, 0, 3]);
        let r = result.getValue(memory);
        assert.equal(r, 5+5-3*3);
    });
});
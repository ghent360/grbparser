import * as assert from 'assert';
import {Memory, AritmeticOperation, ExpressionParser} from "../expressions";

describe("Expression tests", () => {
    it('Primitive expressions', () => {
        let parser = new ExpressionParser("$4+(-14x$1)/(-$5+0.3)");
        let result = parser.parse();
    });
});
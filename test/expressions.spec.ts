/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

import * as assert from 'assert';
import {Memory, AritmeticOperation, ExpressionParser} from "../expressions";

describe("Expression tests", () => {
    it('Primitive expressions', () => {
        let parser = new ExpressionParser("$1+5-$2x3");
        let expr = parser.parse();
        assert.equal(expr.toString(), "$1+5-$2x3");
        let memory = new Memory([5, 3]);
        let result = expr.getValue(memory);
        assert.equal(result, 5+5-3*3);
    });
    it('Unary minus', () => {
        let parser = new ExpressionParser("-$1+5-$2x-3");
        let expr = parser.parse();
        assert.equal(expr.toString(), "-$1+5-$2x-3");
        let memory = new Memory([5, 3]);
        let result = expr.getValue(memory);
        assert.equal(result, -5+5-3*-3);
    });
    it('Brackets', () => {
        let parser = new ExpressionParser("$1x-(10-$2)");
        let expr = parser.parse();
        assert.equal(expr.toString(), "$1x-(10-$2)");
    });
});
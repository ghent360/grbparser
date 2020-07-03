"use strict";
/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpressionParser = exports.Memory = void 0;
class Memory {
    constructor(modifiers) {
        this.variables = [];
        for (let idx = 0; idx < modifiers.length; idx++) {
            this.set(idx + 1, modifiers[idx]);
        }
    }
    get(idx) {
        let result = this.variables[idx];
        if (result === undefined) {
            return 0;
        }
        return result;
    }
    set(idx, value) {
        this.variables[idx] = value;
    }
}
exports.Memory = Memory;
var TokenID;
(function (TokenID) {
    TokenID[TokenID["MINUS"] = 0] = "MINUS";
    TokenID[TokenID["PLUS"] = 1] = "PLUS";
    TokenID[TokenID["TIMES"] = 2] = "TIMES";
    TokenID[TokenID["DIVIDE"] = 3] = "DIVIDE";
    TokenID[TokenID["OPEN_BRACKET"] = 4] = "OPEN_BRACKET";
    TokenID[TokenID["CLOSE_BRACKET"] = 5] = "CLOSE_BRACKET";
    TokenID[TokenID["NUMBER"] = 6] = "NUMBER";
    TokenID[TokenID["VARIABLE"] = 7] = "VARIABLE";
    TokenID[TokenID["END"] = 8] = "END";
})(TokenID || (TokenID = {}));
class ConstantNumber {
    constructor(value) {
        this.value = value;
    }
    getValue() {
        return this.value;
    }
    toString() {
        return this.value.toString();
    }
}
class Variable {
    constructor(id) {
        this.id = id;
    }
    getValue(memory) {
        return memory.get(this.id);
    }
    toString() {
        return `$${this.id}`;
    }
}
class UnaryMinus {
    constructor(op) {
        this.op = op;
    }
    getValue(memory) {
        return -this.op.getValue(memory);
    }
    toString() {
        return `-${this.op}`;
    }
}
class Minus {
    constructor(a, b) {
        this.a = a;
        this.b = b;
    }
    getValue(memory) {
        return this.a.getValue(memory) - this.b.getValue(memory);
    }
    toString() {
        return `${this.a}-${this.b}`;
    }
}
class Plus {
    constructor(a, b) {
        this.a = a;
        this.b = b;
    }
    getValue(memory) {
        return this.a.getValue(memory) + this.b.getValue(memory);
    }
    toString() {
        return `${this.a}+${this.b}`;
    }
}
class Times {
    constructor(a, b) {
        this.a = a;
        this.b = b;
    }
    getValue(memory) {
        return this.a.getValue(memory) * this.b.getValue(memory);
    }
    toString() {
        return `${this.a}x${this.b}`;
    }
}
class Divide {
    constructor(a, b) {
        this.a = a;
        this.b = b;
    }
    getValue(memory) {
        return this.a.getValue(memory) / this.b.getValue(memory);
    }
    toString() {
        return `${this.a}/${this.b}`;
    }
}
class BracketedExpression {
    constructor(op) {
        this.op = op;
    }
    getValue(memory) {
        return this.op.getValue(memory);
    }
    toString() {
        return `(${this.op})`;
    }
}
class ExpressionParser {
    constructor(expression) {
        this.bracketLevel = 0;
        this.expression_ = expression.trim();
    }
    nextToken() {
        this.prevToken = this.token;
        if (this.expression_.length == 0) {
            this.token = { id: TokenID.END, len: 0, token: "" };
            return;
        }
        let match = ExpressionParser.MatchVariable.exec(this.expression_);
        if (match) {
            this.token = { id: TokenID.VARIABLE, len: match[0].length, token: match[1] };
            this.consume();
            return;
        }
        match = ExpressionParser.MatchNumber.exec(this.expression_);
        if (match) {
            this.token = { id: TokenID.NUMBER, len: match[0].length, token: match[1] };
            this.consume();
            return;
        }
        let nextChar = this.expression_[0];
        if (nextChar == '+') {
            this.token = { id: TokenID.PLUS, len: 1, token: nextChar };
        }
        else if (nextChar == 'x' || nextChar == 'X') {
            this.token = { id: TokenID.TIMES, len: 1, token: nextChar };
        }
        else if (nextChar == '/') {
            this.token = { id: TokenID.DIVIDE, len: 1, token: nextChar };
        }
        else if (nextChar == '(') {
            this.token = { id: TokenID.OPEN_BRACKET, len: 1, token: nextChar };
        }
        else if (nextChar == ')') {
            this.token = { id: TokenID.CLOSE_BRACKET, len: 1, token: nextChar };
        }
        else if (nextChar == '-') {
            this.token = { id: TokenID.MINUS, len: 1, token: nextChar };
        }
        this.consume();
        return;
    }
    consume() {
        if (this.token) {
            this.expression_ = this.expression_.substr(this.token.len).trim();
        }
    }
    accept(id) {
        if (this.token && this.token.id == id) {
            this.nextToken();
            return true;
        }
        return false;
    }
    expect(id) {
        if (this.accept(id)) {
            return true;
        }
        throw new Error(`Expected token ID ${TokenID[id]}`);
    }
    operand() {
        if (this.accept(TokenID.VARIABLE) && this.prevToken) {
            return new Variable(Number.parseInt(this.prevToken.token));
        }
        if (this.accept(TokenID.NUMBER) && this.prevToken) {
            return new ConstantNumber(Number.parseFloat(this.prevToken.token));
        }
        if (this.accept(TokenID.OPEN_BRACKET)) {
            let expr = this.expression();
            this.expect(TokenID.CLOSE_BRACKET);
            return new BracketedExpression(expr);
        }
        throw new Error(`Unexpected token ${this.token}`);
    }
    factor() {
        if (this.accept(TokenID.MINUS)) {
            let operand = this.operand();
            if (operand instanceof ConstantNumber) {
                let num = operand;
                num.value *= -1;
                return num;
            }
            return new UnaryMinus(operand);
        }
        else {
            return this.operand();
        }
    }
    term() {
        let factor1 = this.factor();
        while (this.token &&
            (this.token.id == TokenID.TIMES || this.token.id == TokenID.DIVIDE)) {
            let isTimes = this.token.id == TokenID.TIMES;
            this.nextToken();
            let factor2 = this.factor();
            if (isTimes) {
                factor1 = new Times(factor1, factor2);
            }
            else {
                factor1 = new Divide(factor1, factor2);
            }
        }
        return factor1;
    }
    expression() {
        let term1 = this.term();
        while (this.token &&
            (this.token.id == TokenID.PLUS || this.token.id == TokenID.MINUS)) {
            let isPlus = this.token.id == TokenID.PLUS;
            this.nextToken();
            let term2 = this.term();
            if (isPlus) {
                term1 = new Plus(term1, term2);
            }
            else {
                term1 = new Minus(term1, term2);
            }
        }
        return term1;
    }
    parse() {
        this.nextToken();
        let result = this.expression();
        this.expect(TokenID.END);
        return result;
    }
}
exports.ExpressionParser = ExpressionParser;
ExpressionParser.MatchVariable = /^\$(\d+)/;
ExpressionParser.MatchNumber = /^(\d*\.\d*|\d+)/;
//# sourceMappingURL=expressions.js.map
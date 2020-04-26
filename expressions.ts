/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

export class Memory {
    private variables:Array<number> = [];

    constructor(modifiers:Array<number>) {
        for (let idx = 0; idx < modifiers.length; idx++) {
            this.set(idx + 1, modifiers[idx]);
        }
    }

    get(idx:number):number {
        let result = this.variables[idx];
        if (result === undefined) {
            return 0;
        }
        return result;
    }

    set(idx:number, value:number) {
        this.variables[idx] = value;
    }
}

enum TokenID {
    MINUS,
    PLUS,
    TIMES,
    DIVIDE,
    OPEN_BRACKET,
    CLOSE_BRACKET,
    NUMBER,
    VARIABLE,
    END
}

export interface ArithmeticOperation {
    getValue(memory:Memory):number;
}

class ConstantNumber implements ArithmeticOperation {
    constructor(public value:number) {
    }

    getValue():number {
        return this.value;
    }

    toString():string {
        return this.value.toString();
    }
}

class Variable implements ArithmeticOperation {
    constructor(readonly id:number) {
    }

    getValue(memory:Memory):number {
        return memory.get(this.id);
    }

    toString():string {
        return `$${this.id}`;
    }
}

class UnaryMinus implements ArithmeticOperation {
    constructor(public op:ArithmeticOperation) {
    }

    getValue(memory:Memory):number {
        return -this.op.getValue(memory);
    }

    toString():string {
        return `-${this.op}`;
    }
}

class Minus implements ArithmeticOperation {
    constructor(public a:ArithmeticOperation, public b:ArithmeticOperation) {
    }

    getValue(memory:Memory):number {
        return this.a.getValue(memory) - this.b.getValue(memory);
    }

    toString():string {
        return `${this.a}-${this.b}`;
    }
}

class Plus implements ArithmeticOperation {
    constructor(public a:ArithmeticOperation, public b:ArithmeticOperation) {
    }

    getValue(memory:Memory):number {
        return this.a.getValue(memory) + this.b.getValue(memory);
    }

    toString():string {
        return `${this.a}+${this.b}`;
    }
}

class Times implements ArithmeticOperation {
    constructor(public a:ArithmeticOperation, public b:ArithmeticOperation) {
    }

    getValue(memory:Memory):number {
        return this.a.getValue(memory) * this.b.getValue(memory);
    }

    toString():string {
        return `${this.a}x${this.b}`;
    }
}

class Divide implements ArithmeticOperation {
    constructor(public a:ArithmeticOperation, public b:ArithmeticOperation) {
    }

    getValue(memory:Memory):number {
        return this.a.getValue(memory) / this.b.getValue(memory);
    }

    toString():string {
        return `${this.a}/${this.b}`;
    }
}

class BracketedExpression implements ArithmeticOperation {
    constructor(public op:ArithmeticOperation) {
    }

    getValue(memory:Memory):number {
        return this.op.getValue(memory);
    }

    toString():string {
        return `(${this.op})`;
    }
}

interface Token {
    id:TokenID;
    len:number;
    token:string;
}

export class ExpressionParser {
    private expression_:string;
    private token:Token;
    private prevToken:Token;
    private bracketLevel = 0;

    private static MatchVariable = /^\$(\d+)/;
    private static MatchNumber = /^(\d*\.\d*|\d+)/;

    constructor(expression:string) {
        this.expression_ = expression.trim();
    }

    private nextToken() {
        this.prevToken = this.token;
        if (this.expression_.length == 0) {
            this.token = {id:TokenID.END, len:0, token:""};
            return;
        }
        let match = ExpressionParser.MatchVariable.exec(this.expression_);
        if (match) {
            this.token = {id:TokenID.VARIABLE, len:match[0].length, token:match[1]};
            this.consume();
            return
        }
        match = ExpressionParser.MatchNumber.exec(this.expression_);
        if (match) {
            this.token = {id:TokenID.NUMBER, len:match[0].length, token:match[1]};
            this.consume();
            return
        }
        let nextChar = this.expression_[0];
        if (nextChar == '+') {
            this.token = {id:TokenID.PLUS, len:1, token:nextChar};
        } else if (nextChar == 'x' || nextChar == 'X') {
            this.token = {id:TokenID.TIMES, len:1, token:nextChar};
        } else if (nextChar == '/') {
            this.token = {id:TokenID.DIVIDE, len:1, token:nextChar};
        } else if (nextChar == '(') {
            this.token = {id:TokenID.OPEN_BRACKET, len:1, token:nextChar};
        } else if (nextChar == ')') {
            this.token = {id:TokenID.CLOSE_BRACKET, len:1, token:nextChar};
        } else if (nextChar == '-') {
            this.token = {id:TokenID.MINUS, len:1, token:nextChar};
        }
        this.consume();
        return
}

    private consume() {
        this.expression_ = this.expression_.substr(this.token.len).trim();
    }

    private accept(id:TokenID):boolean {
        if (this.token.id == id) {
            this.nextToken();
            return true;
        }
        return false;
    }

    private expect(id:TokenID):boolean {
        if (this.accept(id)) {
            return true;
        }
        throw new Error(`Expected token ID ${TokenID[id]}`);
    }

    private operand():ArithmeticOperation {
        if (this.accept(TokenID.VARIABLE)) {
            return new Variable(Number.parseInt(this.prevToken.token));
        }
        if (this.accept(TokenID.NUMBER)) {
            return new ConstantNumber(Number.parseFloat(this.prevToken.token));
        }
        if (this.accept(TokenID.OPEN_BRACKET)) {
            let expr = this.expression();
            this.expect(TokenID.CLOSE_BRACKET);
            return new BracketedExpression(expr);
        }
        throw new Error(`Unexpected token ${this.token}`);
    }

    private factor():ArithmeticOperation {
        if (this.accept(TokenID.MINUS)) {
            let operand = this.operand();
            if (operand instanceof ConstantNumber) {
                let num = operand as ConstantNumber;
                num.value *= -1;
                return num;
            }
            return new UnaryMinus(operand);
        } else {
            return this.operand();
        }
    }

    private term():ArithmeticOperation {
        let factor1 = this.factor();
        while (this.token.id == TokenID.TIMES || this.token.id == TokenID.DIVIDE) {
            let isTimes = this.token.id == TokenID.TIMES;
            this.nextToken();
            let factor2 = this.factor();
            if (isTimes) {
                factor1 = new Times(factor1, factor2); 
            } else {
                factor1 = new Divide(factor1, factor2);
            }
        }
        return factor1;
    }

    private expression():ArithmeticOperation {
        let term1 = this.term();
        while (this.token.id == TokenID.PLUS || this.token.id == TokenID.MINUS) {
            let isPlus = this.token.id == TokenID.PLUS;
            this.nextToken();
            let term2 = this.term();
            if (isPlus) {
                term1 = new Plus(term1, term2); 
            } else {
                term1 = new Minus(term1, term2);
            }
        }
        return term1;
    }

    parse():ArithmeticOperation {
        this.nextToken();
        let result = this.expression();
        this.expect(TokenID.END);
        return result;
    }
}

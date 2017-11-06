export class Memory {
    private variables:Array<number> = [];

    init(modifiers:Array<number>) {
        for (let idx = 0; idx < modifiers.length; idx++) {
            this.set(idx, modifiers[idx]);
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
    UNARY_MINUS,
    MINUS,
    PLUS,
    TIMES,
    DIVIDE,
    OPEN_BRACKET,
    CLOSE_BRACKET,
    NUMBER,
    VARIABLE
}

export interface AritmeticOperation {
    getValue(memory:Memory):number;
}

class ConstantNumber implements AritmeticOperation {
    constructor(readonly value:number) {
    }

    getValue():number {
        return this.value;
    }
}

class Variable implements AritmeticOperation {
    constructor(readonly id:number) {
    }

    getValue(memory:Memory):number {
        return memory.get(this.id);
    }
}

class UnaryMinus implements AritmeticOperation {
    constructor(public op:AritmeticOperation) {
    }

    getValue(memory:Memory):number {
        return -this.op.getValue(memory);
    }
}


class Minus implements AritmeticOperation {
    constructor(public a:AritmeticOperation, public b:AritmeticOperation) {
    }

    getValue(memory:Memory):number {
        return this.a.getValue(memory) - this.b.getValue(memory);
    }
}

class Plus implements AritmeticOperation {
    constructor(public a:AritmeticOperation, public b:AritmeticOperation) {
    }

    getValue(memory:Memory):number {
        return this.a.getValue(memory) + this.b.getValue(memory);
    }
}

class Times implements AritmeticOperation {
    constructor(public a:AritmeticOperation, public b:AritmeticOperation) {
    }

    getValue(memory:Memory):number {
        return this.a.getValue(memory) * this.b.getValue(memory);
    }
}

class Divide implements AritmeticOperation {
    constructor(public a:AritmeticOperation, public b:AritmeticOperation) {
    }

    getValue(memory:Memory):number {
        return this.a.getValue(memory) / this.b.getValue(memory);
    }
}

interface Token {
    id:TokenID;
    len:number;
    token:string;
}

export class ExpressionParser {
    private expression_:string;
    private tokenStack:Array<Token> = [];
    private bracketLevel = 0;

    private static MetchVariable = /^\$(\d+)/;
    private static MetchNumber = /^([\+\-]?(?:\d*\.\d+|\d+))/;

    constructor(expression:string) {
        this.expression_ = expression.trim();
    }

    private nextToken():Token {
        let match = ExpressionParser.MetchVariable.exec(this.expression_);
        if (match) {
            return {id:TokenID.VARIABLE, len:match[0].length, token:match[1]};
        }
        match = ExpressionParser.MetchNumber.exec(this.expression_);
        if (match) {
            return {id:TokenID.NUMBER, len:match[0].length, token:match[1]};
        }
        let nextChar = this.expression_[0];
        if (nextChar == '+') {
            return {id:TokenID.PLUS, len:1, token:nextChar};
        }
        if (nextChar == 'x' || nextChar == 'X') {
            return {id:TokenID.TIMES, len:1, token:nextChar};
        }
        if (nextChar == '/') {
            return {id:TokenID.DIVIDE, len:1, token:nextChar};
        }
        if (nextChar == '(') {
            return {id:TokenID.OPEN_BRACKET, len:1, token:nextChar};
        }
        if (nextChar == ')') {
            return {id:TokenID.CLOSE_BRACKET, len:1, token:nextChar};
        }
        if (nextChar == '-') {
            let prevToken = this.tokenStack[this.tokenStack.length - 1];
            if (prevToken === undefined || prevToken.id == TokenID.OPEN_BRACKET) {
                return {id:TokenID.UNARY_MINUS, len:1, token:nextChar};    
            }
            return {id:TokenID.MINUS, len:1, token:nextChar};
        }
    }

    private consume(token:Token) {
        this.expression_ = this.expression_.substr(token.len).trim();
    }

    parse():AritmeticOperation {
        while (this.expression_.length > 0) {
            let token = this.nextToken();
            this.tokenStack.push(token);
            this.consume(token);
        }
        return null;
    }
}

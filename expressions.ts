export class Memory {
    private variables:Array<number> = [];

    init(modifiers:Array<number>) {
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
    private token:Token;
    private prevToken:Token;
    private bracketLevel = 0;

    private static MetchVariable = /^\$(\d+)/;
    private static MetchNumber = /^(\d*\.\d+|\d+)/;

    constructor(expression:string) {
        this.expression_ = expression.trim();
    }

    private nextToken() {
        this.prevToken = this.token;
        if (this.expression_.length == 0) {
            this.token = {id:TokenID.END, len:0, token:""};
            return;
        }
        let match = ExpressionParser.MetchVariable.exec(this.expression_);
        if (match) {
            this.token = {id:TokenID.VARIABLE, len:match[0].length, token:match[1]};
            this.consume();
            return
        }
        match = ExpressionParser.MetchNumber.exec(this.expression_);
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
        throw new Error(`Expected token ID ${id}`);
    }

    private operand():AritmeticOperation {
        if (this.accept(TokenID.VARIABLE)) {
            return new Variable(Number.parseInt(this.prevToken.token));
        }
        if (this.accept(TokenID.NUMBER)) {
            return new ConstantNumber(Number.parseFloat(this.prevToken.token));
        }
        if (this.accept(TokenID.OPEN_BRACKET)) {
            let expr = this.expression();
            this.expect(TokenID.CLOSE_BRACKET);
            return expr;
        }
        throw new Error(`Unexpected token ${this.token}`);
    }

    private factor():AritmeticOperation {
        if (this.accept(TokenID.MINUS)) {
            let operand = this.operand();
            return new UnaryMinus(operand);
        } else {
            return this.operand();
        }
    }

    private term():AritmeticOperation {
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

    private expression():AritmeticOperation {
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

    parse():AritmeticOperation {
        this.nextToken();
        let result = this.expression();
        this.expect(TokenID.END);
        return result;
    }
}

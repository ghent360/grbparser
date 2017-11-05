export function vectorLength(v:{x:number, y:number}):number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function scaleVector(v:{x:number, y:number}, s:number):{x:number, y:number} {
    return {x:v.x * s, y:v.y * s};
}

export function unitVector(v:{x:number, y:number}):{x:number, y:number} {
    return scaleVector(v, 1 / vectorLength(v));
}

export function addVector(a:{x:number, y:number}, b:{x:number, y:number})
    : {x:number, y:number} {
    return {x:a.x + b.x, y:a.y + b.y};
}

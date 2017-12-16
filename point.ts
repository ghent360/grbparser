/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */
import {formatFloat} from "./utils";
import {ObjectMirroring} from "./primitives";

export class Point {
    constructor (public x:number = 0, public y:number = 0) {
    }

    isValid():boolean {
        return this.x != undefined && this.y != undefined;
    }

    toString():string {
        return `(${formatFloat(this.x, 3)}, ${formatFloat(this.y, 3)})`;
    }

    add(other:Point):Point {
        return new Point(this.x + other.x, this.y + other.y);
    }

    subtract(other:Point):Point {
        return new Point(this.x - other.x, this.y - other.y);
    }

    scale(scale:number):Point {
        return new Point(this.x * scale, this.y * scale);
    }

    mirror(mirror:ObjectMirroring):Point {
        switch (mirror) {
            case ObjectMirroring.NONE:
                return this.clone();
            case ObjectMirroring.X_AXIS:
                return new Point(-this.x, this.y);
            case ObjectMirroring.Y_AXIS:
                return new Point(this.x, -this.y);
            case ObjectMirroring.XY_AXIS:
                return new Point(-this.x, -this.y);
        }
    }

    distance1(other:Point):number {
        let dx = this.x - other.x;
        let dy = this.y - other.y;
        return Math.abs(dx) + Math.abs(dy);
    }

    distance2(other:Point):number {
        let dx = this.x - other.x;
        let dy = this.y - other.y;
        return dx * dx + dy * dy;
    }

    distance(other:Point):number {
        return Math.sqrt(this.distance2(other));
    }

    clone():Point {
        return new Point(this.x, this.y);
    }

    midPoint(other:Point):Point {
        return new Point((this.x + other.x) / 2, (this.y + other.y) / 2);
    }

    // The angle of the vector (other - this) in radians 0..2PI
    angleFrom(other:Point):number {
        let angle = Math.atan2(other.y - this.y, other.x - this.x);
        if (angle < 0) {
            angle += Math.PI * 2;
        }
        return angle;
    }

    angleTo(other:Point):number {
        let angle = Math.atan2(this.y - other.y, this.x - other.x);
        if (angle < 0) {
            angle += Math.PI * 2;
        }
        return angle;
    }

    // The angle of the vector (this - (0, 0)) in radians 0..2PI
    angle():number {
        let angle = Math.atan2(this.y, this.x);
        if (angle < 0) {
            angle += Math.PI * 2;
        }
        return angle;
    }
}

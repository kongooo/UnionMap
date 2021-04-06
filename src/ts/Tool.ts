interface Coord {
    x: number;
    y: number;
}

interface FrameBufferInfo {
    renderFrameBuffer: WebGLFramebuffer;
    textureFrameBuffer: WebGLFramebuffer;
    targetTexture: WebGLTexture;
}

class CoordUtils {

    static add = (aPos: Coord, bPos: Coord | number) =>
    ({
        x: aPos.x + (typeof bPos === 'number' ? bPos : bPos.x),
        y: aPos.y + (typeof bPos === 'number' ? bPos : bPos.y)
    })

    static sub = (aPos: Coord, bPos: Coord | number) =>
    ({
        x: aPos.x - (typeof bPos === 'number' ? bPos : bPos.x),
        y: aPos.y - (typeof bPos === 'number' ? bPos : bPos.y)
    })

    static division = (aPos: Coord, bPos: Coord | number) =>
    ({
        x: aPos.x / (typeof bPos === 'number' ? bPos : bPos.x),
        y: aPos.y / (typeof bPos === 'number' ? bPos : bPos.y)
    })

    static mult = (aPos: Coord, bPos: Coord | number) =>
    ({
        x: aPos.x * (typeof bPos === 'number' ? bPos : bPos.x),
        y: aPos.y * (typeof bPos === 'number' ? bPos : bPos.y)
    })

    static len = (pos: Coord) => Math.sqrt(pos.x * pos.x + pos.y * pos.y);

    /**
     * 
     * @param pos 
     * @returns 返回一个向量的单位向量
     */
    static normalize = (pos: Coord) => {
        const len = CoordUtils.len(pos);
        return { x: pos.x / len, y: pos.y / len };
    }

    /**
     * 
     * @param vector 旋转向量
     * @param theta 旋转角度
     * @returns 顺时针旋转theta角度后的向量
     */
    static rotate = (vector: Coord, theta: number) => {
        const normVector = CoordUtils.normalize(vector);
        let curTheta = Math.acos(normVector.x);
        if (normVector.y < 0) curTheta = -curTheta;
        return { x: Math.cos(curTheta - theta), y: Math.sin(curTheta - theta) };
    }

    static calTheta = (vector: Coord) => {
        let theta = Math.acos(vector.x);
        if (vector.y < 0) theta = -theta;
        else if (vector.y === 0 && vector.x < 0) theta = -Math.PI;
        return theta;
    }

    static calDistance = (aPos: Coord, bPos: Coord) => {
        const x = bPos.x - aPos.x;
        const y = bPos.y - aPos.y;
        return Math.sqrt(x * x + y * y);
    }

    static calPointToLineDis = (point: Coord, aPos: Coord, bPos: Coord) => {
        const a = CoordUtils.calDistance(aPos, bPos);
        const b = CoordUtils.calDistance(aPos, point);
        const c = CoordUtils.calDistance(bPos, point);
        const s = (a + b + c) / 2;
        const A = Math.sqrt(s * (s - a) * (s - b) * (s - c));
        return A / (2 * a);
    }

    static calLineIntersection = (aPos: Coord, aVector: Coord, bPos: Coord, bVector: Coord) => {
        const k1 = aVector.y / aVector.x;
        const k2 = bVector.y / bVector.x;
        const b1 = aPos.y - aPos.x * k1;
        const b2 = bPos.y - bPos.x * k2;

        const x = (b2 - b1) / (k1 - k2);
        const y = k1 * x + b1;
        return { x, y };
    }

    static calCircleLinePos = (circlePos: Coord, radius: number, aPos: Coord, bPos: Coord) => {
        const centerPos = CoordUtils.division(CoordUtils.add(aPos, bPos), 2);
        const centerToCircle = CoordUtils.calDistance(centerPos, circlePos);
        const len = (radius * radius) / centerToCircle;
        const centerVector = CoordUtils.normalize(CoordUtils.sub(centerPos, circlePos));
        return CoordUtils.add(circlePos, CoordUtils.mult(centerVector, len));
    }

    /**
     * 
     * @param vector 
     * @returns 向量取反
     */
    static reverseVector = (vector: Coord) => ({ x: -vector.x, y: -vector.y });

    /**
     * 
     * @param circlePos 圆心坐标
     * @param point 圆外点坐标
     * @param radius 圆半径
     * @returns 过point对圆的两条切线，单位向量方向圆心朝外
     */
    static calCircleTangent = (circlePos: Coord, point: Coord, radius: number) => {
        const AOVector = CoordUtils.sub(circlePos, point);
        const AOdistance = CoordUtils.calDistance(circlePos, point);
        const theta = Math.asin(radius / AOdistance);
        const leftVector = CoordUtils.normalize(CoordUtils.reverseVector(CoordUtils.rotate(AOVector, -theta)));
        const rightVector = CoordUtils.normalize(CoordUtils.reverseVector(CoordUtils.rotate(AOVector, theta)));
        return { leftVector, rightVector };
    }

    static equal = (a: Coord, b: Coord) => a.x === b.x && a.y === b.y;

    /**
     * 
     * @param aVector 
     * @param bVector 
     * @returns 向量叉积
     */
    static cross = (aVector: Coord, bVector: Coord) => (aVector.x * bVector.y - aVector.y * bVector.x);

    static flipXY = (vector: Coord) => ({ x: vector.y, y: vector.x });

    static absolute = (vector: Coord) => ({ x: Math.abs(vector.x), y: Math.abs(vector.y) });
}

const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

const lerp = (a: number, b: number, t: number) => a + t * (b - a);

const getDir = (a: number) => a === 0 ? 0 : (a < 0 ? -1 : 1);

const swap = (a: Coord, b: Coord) => {
    const t = { x: a.x, y: a.y };
    a.x = b.x;
    a.y = b.y;
    b.x = t.x;
    b.y = t.y;
}

export { Coord, CoordUtils, FrameBufferInfo, clamp, lerp, getDir, swap };

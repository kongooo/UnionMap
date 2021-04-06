import * as React from "react";
import * as ReactDOM from "react-dom";
import "../css/index.css";
import perlinNoise3d from "perlin-noise-3d";
import { CoordUtils } from "./Tool";

interface Coord {
  x: number;
  y: number;
}

interface Grid {
  pos: Coord;
  leftUseful: boolean;
  rightUseful: boolean;
  upUseful: boolean;
  downUseful: boolean;
}

const size = 50;
const ZOOM = 5;
const THRESHOLD = 0.6;
const SLEEP_TIME = 100;
//blue
const TRAVERSED_COLOR = "#9fd8df";
//pink
const TO_TRAERSED_COLOR = "#f5c0c0";
//red
const LINE_COLOR = "#ff7171";

/**
 * dir：
 *      右：1，0
 *      左：-1，0
 *      上：0，1
 *      下：0，-1
 * edge：
 *      dir在x轴上时，1为上边，-1为下边
 *      dir在y轴上时，1为右边，-1为左边
 */
class DrawCanvas extends React.Component {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  mapCount: Coord;
  noise: any;
  vertics: Array<number>;
  obstacleBlocks: Array<Set<number>>;
  lineVertices: Array<number>;
  ctx: CanvasRenderingContext2D;
  //index 与pos的映射
  gridsMap: Map<number, number>;
  grids: Array<Grid>;
  traversedSet: Set<number>;
  toTraverseQueue: Array<Grid>;

  constructor(props: any) {
    super(props);
    this.canvasRef = React.createRef();
    this.vertics = [];
    this.obstacleBlocks = [];
    this.lineVertices = [];
  }

  componentDidMount() {
    this.draw();
  }

  draw = async () => {
    const ctx = this.canvasRef.current.getContext("2d");
    this.ctx = ctx;
    this.noise = new perlinNoise3d();
    this.noise.noiseSeed(randomInt(0, 1000));
    this.mapCount = {
      x: Math.floor(this.canvasRef.current.width / size),
      y: Math.floor(this.canvasRef.current.height / size),
    };

    for (let x = 0; x < this.mapCount.x; x++)
      for (let y = 0; y < this.mapCount.y; y++) {
        const num = this.noise.get(x / ZOOM, y / ZOOM);
        if (num > THRESHOLD) {
          const X = x * size;
          const Y = y * size;
          this.vertics.push(
            ...[X, Y, X + size, Y, X + size, Y + size, X, Y + size]
          );
          const xHas =
            x > 0 && this.noise.get((x - 1) / ZOOM, y / ZOOM) > THRESHOLD;
          const yHas =
            y > 0 && this.noise.get(x / ZOOM, (y - 1) / ZOOM) > THRESHOLD;
          if (xHas && yHas) {
            let xBlockIndex = this.getBlockIndex({ x: x - 1, y });
            let yBlockIndex = this.getBlockIndex({ x, y: y - 1 });
            if (xBlockIndex === yBlockIndex)
              this.addToBlockIndex({ x, y }, xBlockIndex);
            else {
              const index = this.unionBlock(xBlockIndex, yBlockIndex);
              this.addToBlockIndex({ x, y }, index);
            }
          } else if (xHas) {
            let xBlockIndex = this.getBlockIndex({ x: x - 1, y });
            this.addToBlockIndex({ x, y }, xBlockIndex);
          } else if (yHas) {
            let yBlockIndex = this.getBlockIndex({ x, y: y - 1 });
            this.addToBlockIndex({ x, y }, yBlockIndex);
          } else {
            this.addToBlock({ x, y });
          }
          this.drawBlocks();
          await sleep(50);
        }
      }

    await this.drawBlocksLine();
    this.drawLines();
  };

  /**
   * 绘制所有block的外边框
   */
  drawBlocksLine = async () => {
    await new Promise(async (resolve, reject) => {
      for (let i = 0; i < this.obstacleBlocks.length; i++) {
        this.gridsMap = new Map();
        this.grids = Array.from(this.obstacleBlocks[i]).map((num, index) => {
          this.gridsMap.set(num, index);
          return {
            pos: this.NumberToCoord(num),
            leftUseful: true,
            rightUseful: true,
            upUseful: true,
            downUseful: true,
          };
        });
        await this.drawBlockLine();
        await sleep(SLEEP_TIME);
      }
      resolve(1);
    });
  };

  /**
   * 绘制当前block包含的所有格子的外边框
   */
  drawBlockLine = async () => {
    this.traversedSet = new Set();
    this.toTraverseQueue = [];

    await new Promise(async (resolve, reject) => {
      for (let i = 0; i < this.grids.length; i++) {
        //根据格子周围障碍物来更新当前格子状态
        this.updateGridStateWithObstacle(this.grids[i]);
        if (this.traversedSet.has(this.CoordToNumber(this.grids[i].pos))) {
          continue;
        }

        this.toTraverseQueue.push(this.grids[i]);
        this.drawRect(this.grids[i].pos, TO_TRAERSED_COLOR);
        await sleep(SLEEP_TIME);

        while (this.toTraverseQueue.length > 0) {
          const grid = this.toTraverseQueue.shift();

          //下边
          if (grid.downUseful) {
            await this.getLineVertices(
              grid,
              { x: -1, y: 0 },
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: 0 },
              -1
            );
          }

          //上边
          if (grid.upUseful) {
            await this.getLineVertices(
              grid,
              { x: -1, y: 0 },
              { x: 0, y: 1 },
              { x: 1, y: 0 },
              { x: 1, y: 1 },
              1
            );
          }

          //右边
          if (grid.rightUseful) {
            await this.getLineVertices(
              grid,
              { x: 0, y: -1 },
              { x: 1, y: 0 },
              { x: 0, y: 1 },
              { x: 1, y: 1 },
              1
            );
          }

          //左边
          if (grid.leftUseful) {
            await this.getLineVertices(
              grid,
              { x: 0, y: -1 },
              { x: 0, y: 0 },
              { x: 0, y: 1 },
              { x: 0, y: 1 },
              -1
            );
          }
        }
      }
      resolve(1);
    });
  };

  /**
   *
   * @param grid 当前格子
   * @param aDir a方向
   * @param aGridDir a方向对应的起点到格子pos的offset
   * @param bDir b方向
   * @param bGridDir b方向对应的起点到格子pos的offset
   * @param edge
   * 得到a方向到b方向的edge边的两端点
   */
  getLineVertices = async (
    grid: Grid,
    aDir: Coord,
    aGridDir: Coord,
    bDir: Coord,
    bGridDir: Coord,
    edge: number
  ) => {
    const posA = await this.travelWithEdgeAndDir(grid, aDir, edge);
    const posAGrid = CoordUtils.sub(posA, aGridDir);

    if (
      !CoordUtils.equal(grid.pos, posAGrid) &&
      !this.traversedSet.has(this.CoordToNumber(posAGrid)) &&
      this.grids[this.gridsMap.get(this.CoordToNumber(posAGrid))]
    ) {
      this.toTraverseQueue.push(
        this.grids[this.gridsMap.get(this.CoordToNumber(posAGrid))]
      );

      this.drawRect(posAGrid, TO_TRAERSED_COLOR);
    }

    const posB = await this.travelWithEdgeAndDir(grid, bDir, edge);
    const posBGrid = CoordUtils.sub(posB, bGridDir);

    if (
      !CoordUtils.equal(grid.pos, posBGrid) &&
      !this.traversedSet.has(this.CoordToNumber(posBGrid)) &&
      this.grids[this.gridsMap.get(this.CoordToNumber(posBGrid))]
    ) {
      this.toTraverseQueue.push(
        this.grids[this.gridsMap.get(this.CoordToNumber(posBGrid))]
      );

      this.drawRect(posBGrid, TO_TRAERSED_COLOR);
    }

    this.lineVertices.push(posA.x, posA.y, posB.x, posB.y);
    await sleep(SLEEP_TIME);
  };

  /**
   *
   * @param grid
   * @param dir
   * @param edge 上1下-1，右1左-1
   * @returns 从grid开始，朝着dir方向，从edge边开始取得最大长度，并且实时更新遍历到的grid的状态
   */
  travelWithEdgeAndDir = async (grid: Grid, dir: Coord, edge: number) => {
    let startPos = CoordUtils.add(grid.pos, this.getStartPosOffset(dir, edge));
    let count = 1;
    const obstacleDir = CoordUtils.mult(
      CoordUtils.absolute(CoordUtils.flipXY(dir)),
      edge
    );
    let offset = CoordUtils.mult(dir, count);
    let offsetObstacle = CoordUtils.add(offset, obstacleDir);
    let nearObstaclePos = CoordUtils.add(grid.pos, offset);
    let curGridPos = CoordUtils.add(grid.pos, offset);
    await new Promise(async (resolve, reject) => {
      while (
        curGridPos.x >= 0 &&
        curGridPos.x < this.mapCount.x &&
        curGridPos.y >= 0 &&
        curGridPos.y < this.mapCount.y &&
        this.isObstacle(nearObstaclePos) &&
        !this.isObstacle(CoordUtils.add(grid.pos, offsetObstacle))
      ) {
        curGridPos = CoordUtils.add(grid.pos, offset);
        const curGridIndex = this.gridsMap.get(this.CoordToNumber(curGridPos));
        const curGrid = this.grids[curGridIndex];

        this.updateGridStateWithTraverse(curGrid, dir, edge);

        count++;
        offset = CoordUtils.mult(dir, count);
        offsetObstacle = CoordUtils.add(offset, obstacleDir);
        nearObstaclePos = CoordUtils.add(grid.pos, offset);
        await sleep(SLEEP_TIME);
      }
      resolve(1);
    });

    this.updateGridStateWithTraverse(grid, dir, edge);
    let endPos = CoordUtils.add(startPos, offset);
    return endPos;
  };

  /**
   *
   * @param grid
   * 通过四周是否有障碍物来更新grid的状态
   */
  updateGridStateWithObstacle = (grid: Grid) => {
    if (this.isObstacle(CoordUtils.add(grid.pos, { x: 0, y: -1 })))
      grid.downUseful = false;
    if (this.isObstacle(CoordUtils.add(grid.pos, { x: 0, y: 1 })))
      grid.upUseful = false;
    if (this.isObstacle(CoordUtils.add(grid.pos, { x: 1, y: 0 })))
      grid.rightUseful = false;
    if (this.isObstacle(CoordUtils.add(grid.pos, { x: -1, y: 0 })))
      grid.leftUseful = false;
    this.addToTraversedSet(grid);
  };

  /**
   *
   * @param grid
   * @param dir
   * @param edge
   *  将遍历过的边标记为不可用
   */
  updateGridStateWithTraverse = async (
    grid: Grid,
    dir: Coord,
    edge: number
  ) => {
    this.updateGridStateWithObstacle(grid);
    if (dir.x === 0 && edge === 1) grid.rightUseful = false;
    if (dir.x === 0 && edge === -1) grid.leftUseful = false;
    if (dir.y === 0 && edge === 1) grid.upUseful = false;
    if (dir.y === 0 && edge === -1) grid.downUseful = false;

    this.addToTraversedSet(grid);
  };

  /**
   *
   * @param grid
   * 判断当前grid四个边是否还可用，若不可用加入已遍历过集合
   */
  addToTraversedSet = (grid: Grid) => {
    if (
      !grid.rightUseful &&
      !grid.leftUseful &&
      !grid.upUseful &&
      !grid.downUseful
    ) {
      this.traversedSet.add(this.CoordToNumber(grid.pos));
      this.drawRect(grid.pos, TRAVERSED_COLOR);
    }
  };

  /**
   *
   * @param dir 方向
   * @param edge -1下1上，-1左1右
   * @returns 得到起始点到Grid坐标的偏移
   */
  getStartPosOffset = (dir: Coord, edge: number) => {
    if (dir.y === 0) {
      if (dir.x === 1) {
        if (edge === 1) return { x: 0, y: 1 };
        else return { x: 0, y: 0 };
      } else {
        if (edge === 1) return { x: 1, y: 1 };
        else return { x: 1, y: 0 };
      }
    } else if (dir.x === 0) {
      if (dir.y === 1) {
        if (edge === 1) return { x: 1, y: 0 };
        else return { x: 0, y: 0 };
      } else {
        if (edge === 1) return { x: 1, y: 1 };
        else return { x: 0, y: 1 };
      }
    }
  };

  //判断该pos是否有障碍物
  isObstacle = (pos: Coord) => {
    if (
      pos.x < 0 ||
      pos.x >= this.mapCount.x ||
      pos.y < 0 ||
      pos.y >= this.mapCount.y
    )
      return false;
    return this.noise.get(pos.x / ZOOM, pos.y / ZOOM) > THRESHOLD;
  };

  /**
   *
   * @param pos
   * @returns 找到该pos所在的block，没有则返回null
   */
  getBlockIndex = (pos: Coord) => {
    const num = this.CoordToNumber(pos);
    for (let i = 0; i < this.obstacleBlocks.length; i++) {
      if (this.obstacleBlocks[i].has(num)) {
        return i;
      }
    }
    return null;
  };

  /**
   *
   * @param pos
   * 将pos加入新建的block
   */
  addToBlock = (pos: Coord) => {
    const num = this.CoordToNumber(pos);
    let set: Set<number> = new Set();
    set.add(num);
    this.obstacleBlocks.push(set);
    return this.obstacleBlocks.length - 1;
  };

  addToBlockIndex = (pos: Coord, index: number) => {
    const num = this.CoordToNumber(pos);
    if (this.obstacleBlocks[index]) {
      this.obstacleBlocks[index].add(num);
      return;
    }
  };

  unionBlock = (index1: number, index2: number) => {
    const min = Math.min(index1, index2);
    const max = Math.max(index1, index2);
    this.obstacleBlocks[max].forEach((value) => {
      this.obstacleBlocks[min].add(value);
    });
    this.obstacleBlocks.splice(max, 1);
    return min;
  };

  CoordToNumber = (pos: Coord) => {
    if (!pos) return null;
    return pos.x * this.mapCount.y + pos.y;
  };

  NumberToCoord = (num: number) => {
    let x = Math.floor(num / this.mapCount.y);
    let y = num % this.mapCount.y;
    if (x >= this.mapCount.x) {
      x = this.mapCount.x - 1;
      y = num - x * this.mapCount.y;
    }
    return { x, y };
  };

  drawRect = (pos: Coord, color: string) => {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(pos.x * size, pos.y * size, size, size);
  };

  drawBlocks = () => {
    this.obstacleBlocks.forEach((block, index) => {
      block.forEach((value) => {
        const pos = this.NumberToCoord(value);
        this.ctx.fillStyle = `rgb(${index * 10}, ${index * 20}, ${index * 30})`;
        this.ctx.fillRect(pos.x * size, pos.y * size, size, size);
      });
    });
  };

  drawLines = async () => {
    for (let i = 0; i <= this.lineVertices.length - 4; i += 4) {
      const posA = { x: this.lineVertices[i], y: this.lineVertices[i + 1] };
      const posB = { x: this.lineVertices[i + 2], y: this.lineVertices[i + 3] };
      this.drawLine(posA, posB, LINE_COLOR);
      await sleep(200);
    }
  };

  drawLine = (startPos: Coord, endPos: Coord, color: string) => {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 10;
    this.ctx.beginPath();
    this.ctx.moveTo(startPos.x * size, startPos.y * size);
    this.ctx.lineTo(endPos.x * size, endPos.y * size);
    this.ctx.stroke();
  };

  render() {
    return (
      <canvas
        width={document.body.clientWidth * window.devicePixelRatio}
        height={document.body.clientHeight * window.devicePixelRatio}
        style={{
          width: document.body.clientWidth,
          height: document.body.clientHeight,
        }}
        ref={this.canvasRef}
      ></canvas>
    );
  }
}

const randomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min);
};

const sleep = async (time: number) => {
  await new Promise((resolve, reject) => {
    let timer = setTimeout(() => {
      clearTimeout(timer);
      resolve(1);
    }, time);
  });
};

ReactDOM.render(<DrawCanvas />, document.querySelector("#root"));

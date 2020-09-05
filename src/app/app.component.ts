import { Component, OnInit } from '@angular/core';
import {
  Engine,
  Actor,
  Color,
  ActorArgs,
  Vector,
  CollisionType,
  PreCollisionEvent,
} from 'excalibur';
import { PointerMoveEvent } from 'excalibur/dist/Input/Index';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  readonly GAME_DRAW_WIDTH = 800;
  readonly GAME_DRAW_HEIGHT = 600;

  private game: Engine;

  /* Actors */
  private bricks: Actor[] = [];
  private spaceShips: Actor[] = [];
  private particles: Actor[] = [];
  private paddle: Actor;
  private ball: Actor;

  /* Stats */

  private points: number = 0;
  private gameWon: boolean = false;

  ngOnInit(): void {
    this.game = new Engine({
      width: this.GAME_DRAW_WIDTH,
      height: this.GAME_DRAW_HEIGHT,
    });
    this.initializeGame();
  }

  /**
   * Initialisiert das Spiel.
   * Kann bei Bedarf neugestartet werden.
   */
  private initializeGame(): void {
    const self = this;

    this.buildPaddle();
    this.game.input.pointers.primary.on('move', function (evt) {
      self.paddle.pos.x = evt.worldPos.x;
    });

    this.ball = new Actor(100, 300, 20, 20, Color.Magenta);
    this.ball.vel.setTo(200, 200);

    // Ball can collide with spaceships or bricks but nothing else
    this.ball.on('precollision', function (ev: PreCollisionEvent) {
      if (self.bricks.indexOf(ev.other) > -1) {
        self.ballCollides(self.ball, ev.other);
        self.points++;
      }

      if (self.spaceShips.indexOf(ev.other) > -1) {
        self.ballCollides(self.ball, ev.other);
        self.explodeSpaceShip(
          self.ball.pos.x,
          self.ball.pos.y,
          ev.other.width / 10
        );
        self.points++;
      }
      // If Ball collides with particle -> do nothing
      if (self.particles.indexOf(ev.other) == -1) {
        const intersection = ev.intersection.normalize();
        if (Math.abs(intersection.x) > Math.abs(intersection.y)) {
          self.ball.vel.x *= -1;
        } else {
          self.ball.vel.y *= -1;
        }
      }
    });
    // Wire up to the postupdate event
    self.ball.on('postupdate', function () {
      // If the ball collides with the left side
      // of the screen reverse the x velocity
      if (this.pos.x < this.width / 2) {
        this.vel.x *= -1;
      }

      // If the ball collides with the right side
      // of the screen reverse the x velocity
      if (this.pos.x + this.width / 2 > self.GAME_DRAW_WIDTH) {
        this.vel.x *= -1;
      }

      // If the ball collides with the top
      // of the screen reverse the y velocity
      if (this.pos.y < this.height / 2) {
        this.vel.y *= -1;
      }

      if (self.points >= self.bricks.length + self.spaceShips.length) {
        if (!self.gameWon) {
          self.youWinDialog();
        }
      }
    });

    this.ball.on('exitviewport', function () {
      self.youLooseDialog();
    });

    this.ball.draw = function (ctx, delta) {
      ctx.fillStyle = this.color.toString();
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, 10, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    };
    this.game.add(this.ball);

    this.buildBruicks(this.game);
    this.buildSpaceShip(this.game);

    // Paddle collision with particle? Explode
    this.paddle.on('precollision', function (ev: PreCollisionEvent) {
      if (self.particles.indexOf(ev.other) > -1 && ev.other.pos.y > 0) {
        self.paddle.kill();
        self.youLooseDialog();
      }
    });

    //Add Spaceships and check for collision with each other.
    this.spaceShips.forEach((spaceShip: Actor) => {
      spaceShip.on('precollision', function (ev: PreCollisionEvent) {
        // Raumschiffe kolidieren? Abprallen
        if (self.spaceShips.indexOf(ev.other) > -1) {
          spaceShip.vel.x *= -1;
        }
      });

      spaceShip.on('postupdate', function () {
        // Move back if a collision is detected with a border.
        if (
          self.collidesWithRightOrLeftBorder(
            this.pos.x,
            this.width,
            self.GAME_DRAW_WIDTH
          )
        ) {
          spaceShip.vel.x *= -1;
        }
      });
    });
    this.gameWon = false;
    this.game.start();
  }

  /**
   * Erzeugt das Paddle.
   */
  private buildPaddle(): void {
    const paddleArgs: ActorArgs = {
      x: 150,
      y: this.game.drawHeight,
      width: 60,
      height: -40,
      color: Color.DarkGray,
      collisionType: CollisionType.Fixed,
    };
    this.paddle = new Actor(paddleArgs);
    this.paddle.color = Color.DarkGray;

    this.game.add(this.paddle);
  }

  /**
   * Resets all game data by removing them from the game and emptying the fields.
   */
  private resetGameData(): void {
    this.bricks.forEach((brick: Actor) => this.game.remove(brick));
    this.spaceShips.forEach((spaceShip: Actor) => this.game.remove(spaceShip));
    this.particles.forEach((particle: Actor) => this.game.remove(particle));
    this.game.remove(this.paddle);
    this.game.remove(this.ball);
    this.bricks = [];
    this.spaceShips = [];
    this.particles = [];
    this.paddle = null;
    this.ball = null;
    this.points = 0;
  }
  /**
   * Shows the Dialog for loosing
   */
  private youLooseDialog(): void {
    if (confirm('Leider verloren. Erneut versuchen?')) {
      this.resetGameData();
      this.initializeGame();
    } else {
      alert('Danke fürs Spielen!');
    }
  }

  /**
   * Shows the dialog for winning
   */
  private youWinDialog(): void {
    this.gameWon = true;
    if (confirm(`Gewonnen! Punktestand: ${this.points}`)) {
      this.resetGameData();
      this.initializeGame();
    } else {
      alert('Danke fürs Spielen!');
    }
  }

  /**
   * Checks if the current x position collides with the right or left border.
   * @param posX current x position
   * @returns true if it collides, false otherwise
   */
  private collidesWithRightOrLeftBorder(
    posX: number,
    width: number,
    gameWidth: number
  ): boolean {
    if (posX < width / 2) {
      return true;
    }
    if (posX + width / 2 > gameWidth) {
      return true;
    }
    return false;
  }

  /**
   * Function to call when the ball collides with another object. Speeds up the ball
   * and destroys the other object.
   * @param ball
   * @param collisionObject
   */
  private ballCollides(ball: Actor, collisionObject: Actor) {
    ball.vel.x += ball.vel.x / 10;
    ball.vel.y += ball.vel.y / 10;
    if (this.paddle.width > 50) {
      this.paddle.width -= this.paddle.width / 4;
    }
    collisionObject.kill();
  }

  /**
   *
   * Builds an explosion when the spaceship is hit by the ball.
   * @param posX current posX of the spaceship
   * @param posY current posY of the spaceship
   */
  private explodeSpaceShip(
    posX: number,
    posY: number,
    numOfParticle: number = 5
  ) {
    const particleWidth: number = 10;
    const particleHeight: number = 10;
    const color = Color.Black;

    for (let i = 0; i < numOfParticle; i++) {
      const particleArgs: ActorArgs = {
        x: posX + i * numOfParticle,
        y: posY,
        width: particleWidth,
        height: particleHeight,
        color: color,
        vel: this.generateRandomParticleVelocity(),
        collisionType: CollisionType.Passive,
      };

      const particle = new Actor(particleArgs);
      this.particles.push(particle);
    }

    this.particles.forEach((particle: Actor) => this.game.add(particle));
  }

  /**
   * Generates an random vector for the velocity of the particles.
   */
  private generateRandomParticleVelocity(): Vector {
    const velX: number = Math.random() * 50 + 1;
    const velY: number = Math.floor(Math.random() * (150 - 50 + 1) + 50);
    return new Vector(velX * -1, velY);
  }

  /**
   * Creates multiple spaceships
   *
   * @param game
   */
  private buildSpaceShip(game: Engine) {
    const padding = 80;
    const xoffset = 110;
    const yoffset = 20;
    const columns = 3;
    const velocity: Vector = new Vector(100, 0);

    const color = Color.Magenta;

    const spaceShipWidth = game.drawWidth / columns / 2;
    const spaceShipHeight = 10;
    for (let i = 0; i < columns; i++) {
      const spaceShipArgs: ActorArgs = {
        x: xoffset + i * (spaceShipWidth + padding) + padding,
        y: yoffset,
        width: spaceShipWidth,
        height: spaceShipHeight,
        color: color,
        collisionType: CollisionType.Active,
        vel: velocity,
      };
      const ship = new Actor(spaceShipArgs);
      this.spaceShips.push(ship);
    }

    this.spaceShips.forEach((spaceShip: Actor) => game.add(spaceShip));
  }

  /**
   * Creates bricks.
   * @param game
   */
  private buildBruicks(game: Engine) {
    // Padding between bricks
    const padding = 20; // px
    const xoffset = 65; // x-offset
    const yoffset = 40; // y-offset
    const columns = 5;
    const rows = 2;

    const brickWidth = game.drawWidth / columns - padding - padding / columns;
    const brickHeight = 30;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < columns; i++) {
        const brickArgs: ActorArgs = {
          x: xoffset + i * (brickWidth + padding) + padding,
          y: yoffset + j * (brickHeight + padding) + padding,
          width: brickWidth,
          height: brickHeight,
          color: Color.Green,
          collisionType: CollisionType.Active,
        };
        const brick = new Actor(brickArgs);
        this.bricks.push(brick);
      }
    }

    this.bricks.forEach((brick) => game.add(brick));
  }
}

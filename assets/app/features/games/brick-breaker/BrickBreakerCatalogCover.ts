import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';

function drawBrickBreakerCover(parent: Node, width: number, height: number): void {
    const unit = Math.max(1, Math.min(width, height));
    const playWidth = unit * 0.63;
    const playHeight = unit * 0.64;
    const left = -playWidth / 2;
    const bottom = -playHeight / 2;

    const frame = createGraphics(parent, 'BrickBreakerFrameCover', width, height);
    frame.strokeColor = palette.borderStrong;
    frame.lineWidth = Math.max(1.5, unit * 0.006);
    frame.rect(left, bottom, playWidth, playHeight);
    frame.stroke();

    const bricks = createGraphics(parent, 'BrickBreakerBricksCover', width, height);
    const colors = [
        new Color(112, 139, 126, 255),
        new Color(118, 158, 196, 255),
        new Color(144, 126, 190, 255),
        new Color(181, 149, 95, 255),
    ];
    const columns = 5;
    const rows = 4;
    const gap = unit * 0.012;
    const brickWidth = (playWidth - gap * (columns + 1)) / columns;
    const brickHeight = unit * 0.055;
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            if ((row === 2 && column === 1) || (row === 3 && column === 3)) {
                continue;
            }
            const x = left + gap + column * (brickWidth + gap);
            const y = bottom + playHeight - gap - (row + 1) * brickHeight - row * gap;
            bricks.fillColor = colors[(row + column) % colors.length];
            bricks.fillRect(x, y, brickWidth, brickHeight);
        }
    }

    const paddle = createGraphics(parent, 'BrickBreakerPaddleCover', width, height);
    paddle.fillColor = palette.accent;
    const paddleWidth = unit * 0.27;
    const paddleHeight = unit * 0.035;
    paddle.roundRect(
        -paddleWidth / 2,
        bottom + unit * 0.07,
        paddleWidth,
        paddleHeight,
        paddleHeight / 2,
    );
    paddle.fill();

    const ball = createGraphics(parent, 'BrickBreakerBallCover', width, height);
    ball.fillColor = palette.primaryText;
    ball.circle(unit * 0.11, bottom + unit * 0.19, Math.max(4, unit * 0.02));
    ball.fill();

    const trail = createGraphics(parent, 'BrickBreakerTrailCover', width, height);
    trail.strokeColor = new Color(
        palette.primaryText.r,
        palette.primaryText.g,
        palette.primaryText.b,
        105,
    );
    trail.lineWidth = Math.max(1.4, unit * 0.006);
    trail.moveTo(-unit * 0.04, bottom + unit * 0.11);
    trail.lineTo(unit * 0.11, bottom + unit * 0.19);
    trail.lineTo(unit * 0.19, bottom + unit * 0.32);
    trail.stroke();
}

function createGraphics(parent: Node, name: string, width: number, height: number): Graphics {
    return createUiNode(parent, name, width, height).addComponent(Graphics);
}

registerCatalogCover('brick-breaker', drawBrickBreakerCover);

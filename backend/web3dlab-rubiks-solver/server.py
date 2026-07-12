#!/usr/bin/env python3
"""Exact short-path solver API used exclusively by web3dlab demo21."""

from __future__ import annotations

import json
import os
import re
import threading
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

HOST = "127.0.0.1"
PORT = int(os.environ.get("WEB3DLAB_RUBIKS_SOLVER_PORT", "3213"))
SOLVE_PATH = "/api/web3dlab/rubiks/solve"
HEALTH_PATH = "/api/web3dlab/rubiks/health"
SUPPORTED_DIMENSIONS = {4, 5, 6}
FACE_ORDER = "URFDLB"
SOLVE_LOCK = threading.Lock()
REDUCTION_SOLVER_URL = os.environ.get(
    "WEB3DLAB_RUBIKS_REDUCTION_URL",
    "https://8gwifi.org/CubeSolverFunctionality",
)


@dataclass(frozen=True, slots=True)
class MoveSpec:
    axis: str
    layer: int
    notation: str
    permutation: tuple[int, ...]
    quarter_turns: int


@dataclass(slots=True)
class GoalTable:
    paths: dict[bytes, tuple[int, ...]]
    moves: tuple[MoveSpec, ...]


MoveFamily = tuple[str, int]
_GOAL_TABLES: OrderedDict[tuple[int, tuple[MoveFamily, ...], int], GoalTable] = OrderedDict()
_GOAL_TABLE_LIMIT = 2


def _rotate_vector(vector: tuple[int, int, int], axis: str, turns: int) -> tuple[int, int, int]:
    x, y, z = vector
    for _ in range(turns % 4):
        if axis == "x":
            y, z = -z, y
        elif axis == "y":
            x, z = z, -x
        else:
            x, y = -y, x
    return x, y, z


def _facelet_geometry(dimension: int) -> tuple[tuple[int, int, int, int, int, int], ...]:
    high = dimension - 1
    values = tuple(2 * index - high for index in range(dimension))
    geometry: list[tuple[int, int, int, int, int, int]] = []

    for face in FACE_ORDER:
        for row in range(dimension):
            for column in range(dimension):
                if face == "U":
                    position, normal = (values[column], high, values[row]), (0, 1, 0)
                elif face == "R":
                    position, normal = (high, -values[row], -values[column]), (1, 0, 0)
                elif face == "F":
                    position, normal = (values[column], -values[row], high), (0, 0, 1)
                elif face == "D":
                    position, normal = (values[column], -high, -values[row]), (0, -1, 0)
                elif face == "L":
                    position, normal = (-high, -values[row], values[column]), (-1, 0, 0)
                else:
                    position, normal = (-values[column], -values[row], -high), (0, 0, -1)
                geometry.append((*position, *normal))
    return tuple(geometry)


def _move_notation(dimension: int, axis: str, layer: int, quarter_turns: int) -> str:
    positive_face = {"x": "R", "y": "U", "z": "F"}[axis]
    negative_face = {"x": "L", "y": "D", "z": "B"}[axis]
    use_positive_face = layer * 2 >= dimension - 1
    face = positive_face if use_positive_face else negative_face
    depth = dimension - layer if use_positive_face else layer + 1
    base_turn = -1 if use_positive_face else 1
    prefix = "" if depth == 1 else str(depth)
    suffix = "2" if abs(quarter_turns) == 2 else "" if quarter_turns == base_turn else "'"
    return f"{prefix}{face}{suffix}"


def _all_move_families(dimension: int) -> tuple[MoveFamily, ...]:
    return tuple((axis, layer) for axis in "xyz" for layer in range(dimension))


def _create_moves(dimension: int, move_families: tuple[MoveFamily, ...]) -> tuple[MoveSpec, ...]:
    geometry = _facelet_geometry(dimension)
    geometry_index = {entry: index for index, entry in enumerate(geometry)}
    high = dimension - 1
    moves: list[MoveSpec] = []

    for axis, layer in move_families:
        axis_index = "xyz".index(axis)
        centered_layer = 2 * layer - high
        for quarter_turns in (-1, 1, 2):
            source_for_destination = list(range(len(geometry)))
            for source, entry in enumerate(geometry):
                position = entry[:3]
                normal = entry[3:]
                if position[axis_index] != centered_layer:
                    continue
                next_position = _rotate_vector(position, axis, quarter_turns)
                next_normal = _rotate_vector(normal, axis, quarter_turns)
                destination = geometry_index[(*next_position, *next_normal)]
                source_for_destination[destination] = source
            moves.append(MoveSpec(
                axis=axis,
                layer=layer,
                notation=_move_notation(dimension, axis, layer, quarter_turns),
                permutation=tuple(source_for_destination),
                quarter_turns=quarter_turns,
            ))
    return tuple(moves)


def _apply_move(state: bytes, move: MoveSpec) -> bytes:
    return bytes(state[source] for source in move.permutation)


def _inverse_move_indices(moves: tuple[MoveSpec, ...]) -> tuple[int, ...]:
    by_key = {
        (move.axis, move.layer, 2 if abs(move.quarter_turns) == 2 else move.quarter_turns): index
        for index, move in enumerate(moves)
    }
    return tuple(
        by_key[(move.axis, move.layer, 2 if abs(move.quarter_turns) == 2 else -move.quarter_turns)]
        for move in moves
    )


def _solved_state(dimension: int) -> bytes:
    return b"".join(face.encode("ascii") * (dimension * dimension) for face in FACE_ORDER)


def _build_goal_table(
    dimension: int,
    move_families: tuple[MoveFamily, ...],
    depth: int,
) -> GoalTable:
    cache_key = (dimension, move_families, depth)
    cached = _GOAL_TABLES.get(cache_key)
    if cached is not None:
        _GOAL_TABLES.move_to_end(cache_key)
        return cached

    moves = _create_moves(dimension, move_families)
    inverse_indices = _inverse_move_indices(moves)
    goal = _solved_state(dimension)
    paths: dict[bytes, tuple[int, ...]] = {goal: ()}
    frontier = [goal]

    for _ in range(depth):
        next_frontier: list[bytes] = []
        for state in frontier:
            path_to_goal = paths[state]
            previous_key = None
            if path_to_goal:
                previous = moves[inverse_indices[path_to_goal[0]]]
                previous_key = (previous.axis, previous.layer)
            for move_index, move in enumerate(moves):
                if previous_key == (move.axis, move.layer):
                    continue
                child = _apply_move(state, move)
                if child in paths:
                    continue
                paths[child] = (inverse_indices[move_index], *path_to_goal)
                next_frontier.append(child)
        frontier = next_frontier

    table = GoalTable(paths=paths, moves=moves)
    _GOAL_TABLES[cache_key] = table
    _GOAL_TABLES.move_to_end(cache_key)
    while len(_GOAL_TABLES) > _GOAL_TABLE_LIMIT:
        _GOAL_TABLES.popitem(last=False)
    return table


def _search_shortest(
    state: bytes,
    dimension: int,
    move_families: tuple[MoveFamily, ...],
    max_depth: int,
) -> list[str] | None:
    goal_depth = max_depth // 2
    start_depth = max_depth - goal_depth
    table = _build_goal_table(dimension, move_families, goal_depth)
    if state in table.paths:
        return [table.moves[index].notation for index in table.paths[state]]

    paths_from_start: dict[bytes, tuple[int, ...]] = {state: ()}
    frontier = [state]
    for _ in range(start_depth):
        next_frontier: list[bytes] = []
        layer_best: tuple[int, ...] | None = None
        for current in frontier:
            path = paths_from_start[current]
            previous_key = None
            if path:
                previous = table.moves[path[-1]]
                previous_key = (previous.axis, previous.layer)
            for move_index, move in enumerate(table.moves):
                if previous_key == (move.axis, move.layer):
                    continue
                child = _apply_move(current, move)
                if child in paths_from_start:
                    continue
                child_path = (*path, move_index)
                goal_path = table.paths.get(child)
                if goal_path is not None:
                    indices = (*child_path, *goal_path)
                    if layer_best is None or len(indices) < len(layer_best):
                        layer_best = indices
                paths_from_start[child] = child_path
                next_frontier.append(child)
        # Both sides are breadth-first balls. The first start depth that
        # intersects the complete goal ball contains a globally shortest path.
        if layer_best is not None:
            return [table.moves[index].notation for index in layer_best]
        frontier = next_frontier
    return None


def _validate_state(dimension: int, state: str) -> None:
    expected_length = 6 * dimension * dimension
    if len(state) != expected_length:
        raise ValueError(f"Expected {expected_length} facelets, received {len(state)}")
    if set(state) != set(FACE_ORDER):
        raise ValueError("State must contain only URFDLB facelets")
    for face in FACE_ORDER:
        if state.count(face) != dimension * dimension:
            raise ValueError(f"State must contain exactly {dimension * dimension} {face} facelets")


def _validate_move_families(dimension: int, raw_families: Any) -> tuple[MoveFamily, ...] | None:
    if raw_families is None:
        return None
    if not isinstance(raw_families, list):
        raise ValueError("moveFamilies must be an array")

    families: set[MoveFamily] = set()
    for entry in raw_families:
        if not isinstance(entry, dict):
            raise ValueError("Each move family must be an object")
        axis = entry.get("axis")
        layer = entry.get("layer")
        if axis not in "xyz" or not isinstance(layer, int) or not 0 <= layer < dimension:
            raise ValueError("Invalid move family")
        families.add((axis, layer))
    return tuple(sorted(families)) or None


def _expand_wide_move(notation: str, dimension: int) -> list[str]:
    match = re.fullmatch(r"(\d+)?([URFDLB])w(2|')?", notation)
    if not match:
        return [notation]
    width = int(match.group(1) or 2)
    if not 2 <= width <= dimension:
        raise ValueError(f"Invalid wide move from reduction solver: {notation}")
    suffix = match.group(3) or ""
    return [f"{'' if depth == 1 else depth}{match.group(2)}{suffix}" for depth in range(1, width + 1)]


def _verify_solution(dimension: int, state: bytes, notations: list[str]) -> None:
    moves = {move.notation: move for move in _create_moves(dimension, _all_move_families(dimension))}
    current = state
    for notation in notations:
        for expanded in _expand_wide_move(notation, dimension):
            move = moves.get(expanded)
            if move is None:
                raise ValueError(f"Unsupported move from reduction solver: {notation}")
            current = _apply_move(current, move)
    face_size = dimension * dimension
    uniformly_solved = all(
        len(set(current[index * face_size:(index + 1) * face_size])) == 1
        for index in range(6)
    )
    if not uniformly_solved:
        raise ValueError("Reduction solver returned a path that does not solve this state")


def _solve_with_reduction_service(dimension: int, state: bytes) -> list[str]:
    url = f"{REDUCTION_SOLVER_URL}?{urllib.parse.urlencode({'action': 'solve', 'size': dimension})}"
    payload: dict[str, Any] | None = None
    last_error: Exception | None = None
    for _ in range(2):
        request = urllib.request.Request(
            url,
            data=json.dumps({"state": state.decode("ascii")}).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "lyricMVPlayer-web3dlab-demo21",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = json.loads(response.read().decode("utf-8"))
            break
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as error:
            last_error = error

    if payload is None:
        raise ValueError(f"高阶降阶求解服务不可用：{last_error}") from last_error

    moves = payload.get("moves")
    if not payload.get("solved") or not isinstance(moves, list) or not all(isinstance(move, str) for move in moves):
        raise ValueError(str(payload.get("error") or "高阶降阶求解服务未返回有效解法"))
    _verify_solution(dimension, state, moves)
    return moves


def solve_state(
    dimension: int,
    state: str,
    move_families: tuple[MoveFamily, ...] | None = None,
) -> dict[str, Any]:
    if dimension not in SUPPORTED_DIMENSIONS:
        raise ValueError("Only 4x4, 5x5, and 6x6 are handled by this backend")
    _validate_state(dimension, state)
    encoded_state = state.encode("ascii")

    all_families = _all_move_families(dimension)
    moves = _search_shortest(encoded_state, dimension, all_families, max_depth=6)
    search_mode = "all-layers"
    max_depth = 6

    if moves is None and move_families and len(move_families) <= 8:
        # The family list contains no move order. It only narrows the generator
        # set known to contain the current state, so the result is still found
        # from facelets rather than by reversing history.
        max_depth = 8
        moves = _search_shortest(encoded_state, dimension, move_families, max_depth=max_depth)
        search_mode = "relevant-layers"

    if moves is None:
        moves = _solve_with_reduction_service(dimension, encoded_state)
        search_mode = "reduction-pipeline"
        max_depth = 0

    return {
        "dimension": dimension,
        "maxDepth": max_depth,
        "moves": moves,
        "searchMode": search_mode,
        "solver": f"HybridStateReduction{dimension}{dimension}{dimension}",
    }


class SolverHandler(BaseHTTPRequestHandler):
    server_version = "Web3DLabDemo21RubiksSolver/2.0"

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self) -> None:
        self._send_json(204, {})

    def do_GET(self) -> None:
        if self.path == HEALTH_PATH:
            self._send_json(200, {
                "ok": True,
                "demo": "021-paper-rubiks-cube",
                "dimensions": sorted(SUPPORTED_DIMENSIONS),
                "python": "root uv / 3.12",
            })
            return
        self._send_json(404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:
        if self.path != SOLVE_PATH:
            self._send_json(404, {"ok": False, "error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 100_000:
                raise ValueError("Invalid request body size")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            dimension = int(payload.get("dimension"))
            state = str(payload.get("state", ""))
            move_families = _validate_move_families(dimension, payload.get("moveFamilies"))
            with SOLVE_LOCK:
                result = solve_state(dimension, state, move_families)
            self._send_json(200, {"ok": True, **result})
        except ValueError as error:
            self._send_json(400, {"ok": False, "error": str(error)})
        except Exception as error:
            self._send_json(500, {"ok": False, "error": str(error)})

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[demo21-rubiks-solver] {fmt % args}")


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), SolverHandler)
    print(f"[demo21-rubiks-solver] listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

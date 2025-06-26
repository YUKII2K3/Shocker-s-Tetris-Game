import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trophy, Zap, Activity, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CircleUserRound, Github, Linkedin, Globe, LogOut, Sun, Moon, Laptop } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const INITIAL_DROP_TIME = 1000;
const SPEED_INCREASE = 50;
const LEVEL_THRESHOLD = 1000;

const createEmptyBoard = () =>
  Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));

const TETROMINOS = [
  { shape: [[1, 1, 1, 1]], color: '#00f0f0' },
  { shape: [[1, 1], [1, 1]], color: '#f0f000' },
  { shape: [[0, 1, 1], [1, 1, 0]], color: '#00f000' },
  { shape: [[1, 1, 0], [0, 1, 1]], color: '#f00000' },
  { shape: [[1, 0, 0], [1, 1, 1]], color: '#a000f0' },
  { shape: [[0, 0, 1], [1, 1, 1]], color: '#f0a000' },
  { shape: [[0, 1, 0], [1, 1, 1]], color: '#0000f0' },
];

const rotateMatrix = (matrix) =>
  matrix[0].map((_, index) => matrix.map(row => row[index]).reverse());

const Tetris = () => {
  const [board, setBoard] = useState(createEmptyBoard());
  const [currentPiece, setCurrentPiece] = useState(null);
  const [nextPiece, setNextPiece] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [dropTime, setDropTime] = useState(INITIAL_DROP_TIME);
  const [highScores, setHighScores] = useState([]);
  const [flashRows, setFlashRows] = useState([]);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const gameRef = useRef(null);

  // Theme switcher logic
  const { setTheme, theme } = useTheme ? useTheme() : { setTheme: () => {}, theme: "system" };

  const getRandomTetromino = useCallback(() => {
    const randTetromino = TETROMINOS[Math.floor(Math.random() * TETROMINOS.length)];
    return {
      ...randTetromino,
      pos: { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 },
    };
  }, []);

  const isValidMove = useCallback((piece, board, offsetX = 0, offsetY = 0) => {
    return piece.shape.every((row, y) =>
      row.every((value, x) =>
        value === 0 ||
        (board[y + piece.pos.y + offsetY] &&
          board[y + piece.pos.y + offsetY][x + piece.pos.x + offsetX] === 0)
      )
    );
  }, []);

  const merge = useCallback((board, piece) => {
    piece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          board[y + piece.pos.y][x + piece.pos.x] = piece.color;
        }
      });
    });
    return board;
  }, []);

  const clearRows = useCallback((board) => {
    let rowsCleared = [];
    const newBoard = board.reduce((acc, row, index) => {
      if (row.every(cell => cell !== 0)) {
        rowsCleared.push(index);
        acc.unshift(Array(BOARD_WIDTH).fill(0));
      } else {
        acc.push(row);
      }
      return acc;
    }, []);
    
    if (rowsCleared.length > 0) {
      setFlashRows(rowsCleared);
      setTimeout(() => setFlashRows([]), 500);
      const newScore = score + rowsCleared.length * 100 * level;
      setScore(newScore);
      if (newScore >= level * LEVEL_THRESHOLD) {
        setLevel(prev => prev + 1);
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 2000);
        setDropTime(prev => Math.max(prev - SPEED_INCREASE, 100));
      }
    }
    
    return newBoard;
  }, [score, level]);

  const movePlayer = useCallback((dir) => {
    if (!isValidMove(currentPiece, board, dir, 0)) return;
    setCurrentPiece(prev => ({
      ...prev,
      pos: { x: prev.pos.x + dir, y: prev.pos.y },
    }));
  }, [currentPiece, board, isValidMove]);

  const hardDrop = useCallback(() => {
    let newY = currentPiece.pos.y;
    while (isValidMove(currentPiece, board, 0, newY - currentPiece.pos.y + 1)) {
      newY++;
    }
    setCurrentPiece(prev => ({
      ...prev,
      pos: { ...prev.pos, y: newY },
    }));
  }, [currentPiece, board, isValidMove]);

  const drop = useCallback(() => {
    if (!isValidMove(currentPiece, board, 0, 1)) {
      if (currentPiece.pos.y < 1) {
        setGameOver(true);
        return;
      }
      const newBoard = merge(board, currentPiece);
      setBoard(clearRows(newBoard));
      setCurrentPiece(nextPiece);
      setNextPiece(getRandomTetromino());
    } else {
      setCurrentPiece(prev => ({
        ...prev,
        pos: { x: prev.pos.x, y: prev.pos.y + 1 },
      }));
    }
    // Force a drop after rotation if the piece is floating
    if (currentPiece && !isValidMove(currentPiece, board, 0, 1)) {
      const newBoard = merge(board, currentPiece);
      setBoard(clearRows(newBoard));
      setCurrentPiece(nextPiece);
      setNextPiece(getRandomTetromino());
    }
  }, [currentPiece, nextPiece, board, isValidMove, merge, clearRows, getRandomTetromino]);

  const rotate = useCallback(() => {
    const rotated = { ...currentPiece, shape: rotateMatrix(currentPiece.shape) };
    if (isValidMove(rotated, board)) {
      setCurrentPiece(rotated);
    } else {
      // Try to adjust the position if rotation is not possible at the current position
      const kickOffsets = [
        { x: 0, y: -1 }, // Try moving up
        { x: 1, y: 0 },  // Try moving right
        { x: -1, y: 0 }, // Try moving left
        { x: 0, y: 1 }   // Try moving down
      ];

      for (let offset of kickOffsets) {
        const adjustedRotated = {
          ...rotated,
          pos: { x: rotated.pos.x + offset.x, y: rotated.pos.y + offset.y }
        };
        if (isValidMove(adjustedRotated, board)) {
          setCurrentPiece(adjustedRotated);
          return;
        }
      }
    }
  }, [currentPiece, board, isValidMove]);

  useEffect(() => {
    if (gameStarted && !currentPiece) {
      setCurrentPiece(getRandomTetromino());
      setNextPiece(getRandomTetromino());
    }

    const handleKeyPress = (e) => {
      if (gameOver || !gameStarted) return;
      switch (e.key) {
        case 'a': case 'A': movePlayer(-1); break;
        case 'd': case 'D': movePlayer(1); break;
        case 's': case 'S': drop(); break;
        case 'e': case 'E': hardDrop(); break;
        case ' ': rotate(); break;
        default: break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentPiece, gameOver, gameStarted, getRandomTetromino, movePlayer, drop, hardDrop, rotate]);

  useEffect(() => {
    if (gameOver || !gameStarted) return;
    const dropInterval = setInterval(drop, dropTime);
    return () => {
      clearInterval(dropInterval);
    };
  }, [drop, dropTime, gameOver, gameStarted]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      gameRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const startGame = () => {
    setGameStarted(true);
    setBoard(createEmptyBoard());
    setCurrentPiece(getRandomTetromino());
    setNextPiece(getRandomTetromino());
    setGameOver(false);
    setScore(0);
    setLevel(1);
    setDropTime(INITIAL_DROP_TIME);
  };

  const restartGame = () => {
    setBoard(createEmptyBoard());
    setCurrentPiece(getRandomTetromino());
    setNextPiece(getRandomTetromino());
    setGameOver(false);
    setScore(0);
    setLevel(1);
    setDropTime(INITIAL_DROP_TIME);
    setHighScores(prev => {
      const newHighScores = [...prev, { score, date: new Date().toLocaleDateString() }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      return newHighScores;
    });
  };

  const handleLogout = () => {
    toast.success("Logged out!");
    // Add your real logout logic here
  };

  return (
    <div ref={gameRef} className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4">
      {/* Profile Dropdown Button - Top Right */}
      <div className="absolute top-4 right-4 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="bg-gray-800 hover:bg-gray-700 rounded-full p-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <CircleUserRound size={28} strokeWidth={2} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-w-64 min-w-[220px]">
            <DropdownMenuLabel className="flex flex-col">
              <span>Signed in as</span>
              <span className="text-xs font-normal text-foreground">yukiis.dev@gmail.com</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <a href="https://my-portfolio-ten-tan-36.vercel.app/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Portfolio
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="https://github.com/YUKII2K3" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Github className="w-4 h-4" /> GitHub
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="https://linkedin.com/in/yuktheshwar-mp" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4" /> LinkedIn
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setTheme && setTheme('light')} className={theme === 'light' ? 'bg-accent' : ''}>
                <Sun className="w-4 h-4 mr-2" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme && setTheme('dark')} className={theme === 'dark' ? 'bg-accent' : ''}>
                <Moon className="w-4 h-4 mr-2" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme && setTheme('system')} className={theme === 'system' ? 'bg-accent' : ''}>
                <Laptop className="w-4 h-4 mr-2" /> System
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-500 flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h1 className="text-4xl md:text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Shocker's Tetris</h1>
      <div className="flex flex-col md:flex-row items-center md:items-start justify-center w-full max-w-6xl">
        <div className="mb-4 md:mb-0 md:mr-4 bg-gray-800 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl mb-2 font-semibold">Next Block</h2>
          <div className="border-2 border-gray-700 p-2 bg-gray-900 rounded-md">
            {nextPiece && nextPiece.shape.map((row, y) => (
              <div key={y} className="flex">
                {row.map((cell, x) => (
                  <div
                    key={x}
                    className="w-4 h-4 md:w-6 md:h-6 border border-gray-800 rounded-sm"
                    style={{
                      backgroundColor: cell ? nextPiece.color : 'transparent'
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <h2 className="text-xl mb-2 font-semibold">Controls</h2>
            <ul className="text-xs md:text-sm space-y-1">
              <li className="flex items-center"><span className="w-6 h-6 md:w-8 md:h-8 bg-gray-700 rounded-full flex items-center justify-center mr-2">A</span>Move Left</li>
              <li className="flex items-center"><span className="w-6 h-6 md:w-8 md:h-8 bg-gray-700 rounded-full flex items-center justify-center mr-2">D</span>Move Right</li>
              <li className="flex items-center"><span className="w-6 h-6 md:w-8 md:h-8 bg-gray-700 rounded-full flex items-center justify-center mr-2">S</span>Move Down</li>
              <li className="flex items-center"><span className="w-6 h-6 md:w-8 md:h-8 bg-gray-700 rounded-full flex items-center justify-center mr-2">E</span>Hard Drop</li>
              <li className="flex items-center"><span className="w-6 h-6 md:w-8 md:h-8 bg-gray-700 rounded-full flex items-center justify-center mr-2">␣</span>Rotate</li>
            </ul>
          </div>
        </div>
        <div className="relative mb-4 md:mb-0">
          <div className="border-4 border-gray-700 p-2 bg-gray-900 rounded-lg shadow-xl">
            {board.map((row, y) => (
              <div key={y} className="flex">
                {row.map((cell, x) => (
                  <div
                    key={x}
                    className={`w-6 h-6 md:w-8 md:h-8 border border-gray-800 rounded-sm transition-all duration-150 ${
                      flashRows.includes(y) ? 'animate-pulse bg-white' : ''
                    }`}
                    style={{
                      backgroundColor: cell || 
                        (currentPiece &&
                         currentPiece.shape[y - currentPiece.pos.y] &&
                         currentPiece.shape[y - currentPiece.pos.y][x - currentPiece.pos.x] ?
                         currentPiece.color : 'transparent')
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          {showLevelUp && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-500 text-black p-4 rounded-lg animate-bounce shadow-lg">
              <p className="text-2xl font-bold">Level Up!</p>
            </div>
          )}
        </div>
        <div className="md:ml-4 bg-gray-800 p-4 rounded-lg shadow-lg">
          <div className="mb-4">
            <h2 className="text-xl mb-2 font-semibold flex items-center">
              <Trophy className="mr-2" /> Score
            </h2>
            <p className="text-3xl font-bold">{score}</p>
          </div>
          <div className="mb-4">
            <h2 className="text-xl mb-2 font-semibold flex items-center">
              <Zap className="mr-2" /> Level
            </h2>
            <p className="text-3xl font-bold">{level}</p>
          </div>
          <div>
            <h2 className="text-xl mb-2 font-semibold flex items-center">
              <Activity className="mr-2" /> High Score
            </h2>
            <ul className="space-y-1 text-sm">
              {highScores.map((hs, index) => (
                <li key={index} className="bg-gray-700 p-2 rounded-md">
                  <span className="font-bold">{hs.score}</span> - {hs.date}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-4 flex space-x-4">
        <Button onClick={startGame} disabled={gameStarted} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
          Start Game
        </Button>
        <Button onClick={toggleFullscreen} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
          {isFullscreen ? <Minimize className="mr-2" /> : <Maximize className="mr-2" />}
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </Button>
      </div>
      <AlertDialog open={gameOver}>
        <AlertDialogContent className="bg-gray-800 border-2 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-3xl text-red-500">Game Over</AlertDialogTitle>
            <AlertDialogDescription className="text-xl">
              Score: <span className="font-bold text-2xl">{score}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={startGame} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
              Play Again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Tetris;

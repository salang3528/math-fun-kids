import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import correctSound from './sounds/correct.wav';
import wrongSound from './sounds/wrong.wav';
import comboSound from './sounds/combo.wav';
import levelupSound from './sounds/levelup.wav';
import bgmSound from './sounds/bgm.wav';

function getRandomEmoji(type: 'correct' | 'wrong' | 'timeout' | 'combo') {
  const corrects = ['⭐', '🎉', '🎆', '💖', '👏', '🥳'];
  const wrongs = ['😢', '🐻', '🐱', '🙈', '😅', '🦊'];
  const timeouts = ['⏰', '⌛', '🕒', '😮'];
  const combos = ['🔥', '⚡', '💥', '🌟', '🚀', '🎇'];
  if (type === 'timeout') return timeouts[Math.floor(Math.random() * timeouts.length)];
  if (type === 'combo') return combos[Math.floor(Math.random() * combos.length)];
  const arr = type === 'correct' ? corrects : wrongs;
  return arr[Math.floor(Math.random() * arr.length)];
}

type MathType = '덧셈' | '뺄셈' | '곱셈' | '나눗셈';

function getLevelParams(level: number, type: MathType) {
  // 레벨에 따라 숫자 범위와 곱셈/나눗셈 난이도 증가
  if (type === '곱셈' || type === '나눗셈') {
    return {
      min: 1 + Math.floor(level / 2),
      max: 10 + level * 2,
    };
  } else {
    return {
      min: 1 + Math.floor(level / 2),
      max: 20 + level * 3,
    };
  }
}

function generateQuestion(type: MathType, level: number) {
  const { min, max } = getLevelParams(level, type);
  let a = Math.floor(Math.random() * (max - min + 1)) + min;
  let b = Math.floor(Math.random() * (max - min + 1)) + min;
  let question = '';
  let answer = 0;
  if (type === '덧셈') {
    question = `${a} + ${b}`;
    answer = a + b;
  } else if (type === '뺄셈') {
    if (a < b) [a, b] = [b, a];
    question = `${a} - ${b}`;
    answer = a - b;
  } else if (type === '곱셈') {
    question = `${a} × ${b}`;
    answer = a * b;
  } else if (type === '나눗셈') {
    b = Math.floor(Math.random() * (max - min + 1)) + min;
    answer = Math.floor(Math.random() * (max - min + 1)) + min;
    a = b * answer;
    question = `${a} ÷ ${b}`;
  }
  const choices = new Set([answer]);
  while (choices.size < 4) {
    let delta = Math.floor(Math.random() * 7) - 3;
    let wrong = answer + delta;
    if (type === '나눗셈' && wrong <= 0) wrong = answer + Math.abs(delta) + 1;
    if (wrong !== answer) choices.add(wrong);
  }
  return {
    question,
    answer,
    choices: Array.from(choices).sort(() => Math.random() - 0.5),
  };
}

const TOTAL_QUESTIONS = 10;
const TIME_LIMIT = 10; // 10초

function getCharacterEmoji({
  feedback,
  combo,
  levelUp,
  gameOver,
  score,
  maxScore,
}: {
  feedback: string | null;
  combo: number;
  levelUp: boolean;
  gameOver: boolean;
  score: number;
  maxScore: number;
}) {
  if (gameOver) {
    if (score === maxScore) return '🐰🏆';
    if (score >= Math.floor(maxScore * 0.7)) return '🐰😃';
    return '🐰😊';
  }
  if (levelUp) return '🐰🚀';
  if (combo >= 3) return '🐰🔥';
  if (feedback === 'correct') return '🐰😆';
  if (feedback === 'wrong' || feedback === 'timeout') return '🐰😢';
  return '🐰';
}

function getBadges({
  score,
  maxScore,
  maxCombo,
  fastAnswers
}: {
  score: number;
  maxScore: number;
  maxCombo: number;
  fastAnswers: number;
}) {
  const badges = [];
  if (score === maxScore) badges.push({ emoji: '🥇', label: '수학 천재' });
  if (score >= Math.floor(maxScore * 0.7)) badges.push({ emoji: '🥈', label: '수학 챔피언' });
  if (maxCombo >= 5) badges.push({ emoji: '🏅', label: '콤보 마스터' });
  if (fastAnswers >= 3) badges.push({ emoji: '⚡', label: '스피드 퀴즈왕' });
  return badges;
}

function getBestScore() {
  const s = localStorage.getItem('math-fun-kids-best-score');
  return s ? parseInt(s, 10) : 0;
}
function setBestScore(score: number) {
  localStorage.setItem('math-fun-kids-best-score', score.toString());
}

function App() {
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelUp, setLevelUp] = useState(false);
  const [questionObj, setQuestionObj] = useState(generateQuestion('덧셈', 1));
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'timeout' | null>(null);
  const [showNext, setShowNext] = useState(false);
  const [questionNum, setQuestionNum] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [emoji, setEmoji] = useState('');
  const [mathType, setMathType] = useState<MathType | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboEffect, setComboEffect] = useState(false);
  const [fastAnswers, setFastAnswers] = useState(0);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const [bestScore, setBestScoreState] = useState(getBestScore());
  const [newBest, setNewBest] = useState(false);

  useEffect(() => {
    if (started && !feedback && !gameOver) {
      setTimeLeft(TIME_LIMIT);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setFeedback('timeout');
            setEmoji(getRandomEmoji('timeout'));
            setShowNext(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [started, questionObj, feedback, gameOver]);

  useEffect(() => {
    if (started && !gameOver) {
      if (!bgmRef.current) {
        bgmRef.current = new Audio(bgmSound);
        bgmRef.current.loop = true;
        bgmRef.current.volume = 0.3;
      }
      bgmRef.current.currentTime = 0;
      bgmRef.current.play();
    } else {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current.currentTime = 0;
      }
    }
    return () => {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current.currentTime = 0;
      }
    };
  }, [started, gameOver]);

  useEffect(() => {
    if (gameOver) {
      if (score > bestScore) {
        setBestScore(score);
        setBestScoreState(score);
        setNewBest(true);
        setTimeout(() => setNewBest(false), 2000);
      }
    }
    // eslint-disable-next-line
  }, [gameOver]);

  const startGame = () => {
    setScore(0);
    setLevel(1);
    setLevelUp(false);
    setQuestionObj(generateQuestion(mathType || '덧셈', 1));
    setStarted(true);
    setFeedback(null);
    setShowNext(false);
    setQuestionNum(1);
    setGameOver(false);
    setEmoji('');
    setTimeLeft(TIME_LIMIT);
    setCombo(0);
    setMaxCombo(0);
    setComboEffect(false);
    setFastAnswers(0);
    playSound('levelup');
  };

  const handleChoice = (choice: number) => {
    if (feedback) return;
    if (choice === questionObj.answer) {
      if (timeLeft >= 7) setFastAnswers(f => f + 1);
      setCombo(c => {
        const newCombo = c + 1;
        if (newCombo > maxCombo) setMaxCombo(newCombo);
        if (newCombo >= 2) {
          setComboEffect(true);
          setTimeout(() => setComboEffect(false), 900);
          playSound('combo');
        } else {
          playSound('correct');
        }
        return newCombo;
      });
      setScore(s => s + 1 + (combo >= 1 ? 1 : 0));
      setFeedback('correct');
      setEmoji(getRandomEmoji('correct'));
      if ((questionNum) % 3 === 0 && level < 10) {
        setLevel(l => l + 1);
        setLevelUp(true);
        setTimeout(() => setLevelUp(false), 1200);
        playSound('levelup');
      }
    } else {
      setFeedback('wrong');
      setEmoji(getRandomEmoji('wrong'));
      setCombo(0);
      playSound('wrong');
    }
    setShowNext(true);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const nextQuestion = () => {
    if (questionNum >= TOTAL_QUESTIONS) {
      setGameOver(true);
      setStarted(false);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setQuestionObj(generateQuestion(mathType || '덧셈', level));
    setFeedback(null);
    setShowNext(false);
    setQuestionNum(n => n + 1);
    setEmoji('');
    setTimeLeft(TIME_LIMIT);
  };

  const playSound = (type: 'correct' | 'wrong' | 'combo' | 'levelup') => {
    let audio;
    if (type === 'correct') audio = new Audio(correctSound);
    if (type === 'wrong') audio = new Audio(wrongSound);
    if (type === 'combo') audio = new Audio(comboSound);
    if (type === 'levelup') audio = new Audio(levelupSound);
    if (audio) {
      audio.volume = 0.7;
      audio.play();
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <span className="App-emoji" role="img" aria-label="rabbit">
          {getCharacterEmoji({
            feedback,
            combo,
            levelUp,
            gameOver,
            score,
            maxScore: TOTAL_QUESTIONS,
          })}
        </span>
        <h1 className="App-title">Math Fun Kids</h1>
        <div className="best-score-area">
          🏅 최고 점수: <b>{bestScore}</b>
          {newBest && <span className="new-best">최고 점수 갱신! 🎉</span>}
        </div>
        {!started && !gameOver ? (
          <>
            <p className="App-desc">재미있는 수학 암산 게임!<br/>문제를 풀고 점수를 모아보세요!</p>
            <div className="type-select">
              <span>문제 유형 선택: </span>
              {(['덧셈','뺄셈','곱셈','나눗셈'] as MathType[]).map(type => (
                <button
                  key={type}
                  className={`type-btn${mathType === type ? ' selected' : ''}`}
                  onClick={() => setMathType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
            <button className="App-start-btn" onClick={startGame} disabled={!mathType}>게임 시작</button>
          </>
        ) : null}
        {started && !gameOver && (
          <div className="game-area">
            <div className="score">점수: <b>{score}</b> / {TOTAL_QUESTIONS}</div>
            <div className="level-area">
              <span className={`level-badge${levelUp ? ' levelup' : ''}`}>Lv.{level}</span>
              {levelUp && <span className="levelup-msg">레벨업! 🚀</span>}
            </div>
            <div className="combo-area">
              {combo >= 2 && (
                <span className={`combo-badge${comboEffect ? ' combo-anim' : ''}`}>{getRandomEmoji('combo')} {combo} 콤보!</span>
              )}
              {maxCombo >= 2 && !started && !gameOver && (
                <span className="max-combo">최고 콤보: {maxCombo}</span>
              )}
            </div>
            <div className="timer-bar">
              <div className="timer-inner" style={{width: `${(timeLeft/TIME_LIMIT)*100}%`}} />
              <span className={`timer-text${timeLeft <= 3 ? ' danger' : ''}`}>⏰ {timeLeft}초</span>
            </div>
            <div className="question">Q{questionNum}. {questionObj.question} = ?</div>
            <div className="choices">
              {questionObj.choices.map((c, i) => (
                <button
                  key={i}
                  className={`choice-btn${feedback && c === questionObj.answer ? ' correct' : ''}${feedback && c !== questionObj.answer && c === questionObj.choices[i] && feedback === 'wrong' ? ' wrong' : ''}`}
                  onClick={() => handleChoice(c)}
                  disabled={!!feedback}
                >
                  {c}
                </button>
              ))}
            </div>
            {feedback && (
              <div className={`feedback ${feedback}`}>
                {feedback === 'correct' ? (
                  <>
                    정답! <span className="feedback-emoji pop">{emoji}</span>
                  </>
                ) : feedback === 'timeout' ? (
                  <>
                    시간 초과! <span className="feedback-emoji shake">{emoji}</span><br/>정답은 <b>{questionObj.answer}</b>
                  </>
                ) : (
                  <>
                    아쉬워요! <span className="feedback-emoji shake">{emoji}</span><br/>정답은 <b>{questionObj.answer}</b>
                  </>
                )}
              </div>
            )}
            {showNext && (
              <button className="App-next-btn" onClick={nextQuestion}>다음 문제</button>
            )}
          </div>
        )}
        {gameOver && (
          <div className="game-area">
            <div className="score final">최종 점수: <b>{score}</b> / {TOTAL_QUESTIONS}</div>
            <div className="final-emoji">{score === TOTAL_QUESTIONS ? '🏆🥇🎉' : score >= 7 ? '👏😃' : '👍😊'}</div>
            <div className="final-msg">
              {score === TOTAL_QUESTIONS ? '완벽해요! 천재 수학왕!' : score >= 7 ? '아주 잘했어요! 멋져요!' : '조금만 더 연습해볼까요?'}
            </div>
            <div className="badge-list">
              {getBadges({ score, maxScore: TOTAL_QUESTIONS, maxCombo, fastAnswers }).length > 0 ? (
                getBadges({ score, maxScore: TOTAL_QUESTIONS, maxCombo, fastAnswers }).map((b, i) => (
                  <span className="badge" key={i}>{b.emoji} {b.label}</span>
                ))
              ) : (
                <span className="badge none">아직 업적이 없어요! 도전해보세요!</span>
              )}
            </div>
            <button className="App-start-btn" onClick={startGame}>다시하기</button>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;

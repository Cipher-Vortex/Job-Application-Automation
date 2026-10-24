@echo off
title JobPilot Autonomous Scout & Bounty Hunter
echo ==================================================================
echo Starting JobPilot Scout in continuous 15-minute background loop...
echo Logs and pitches saved to data/pending_pitches.json
echo Close this window or press Ctrl+C to terminate.
echo ==================================================================
npm run scout:watch
pause

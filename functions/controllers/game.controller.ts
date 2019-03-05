import {
    Game, GameOperations, GameStatus, OpponentType, PlayerQnA, pushNotificationRouteConstants, schedulerConstants
} from '../../projects/shared-library/src/lib/shared/model';
import { AppSettings } from '../services/app-settings.service';
import { GameService } from '../services/game.service';
import { GameMechanics } from '../utils/game-mechanics';
import { PushNotification } from '../utils/push-notifications';
import { SystemStatsCalculations } from '../utils/system-stats-calculations';
import { Utils } from '../utils/utils';
import { AccountService as generalAccountService } from '../services/account.service';
import { SocialService as socialGameService } from '../services/social.service';
const functions = require('firebase-functions');

export class GameController {

    private static pushNotification: PushNotification = new PushNotification();
    private static appSettings: AppSettings = new AppSettings();

    /**
     * createGame
     * return gameId
     */
    static async createGame(req, res) {
        try {
            const gameOptions = req.body.gameOptions;
            const userId = req.body.userId;

            if (!gameOptions) {
                // Game Option is not added
                res.status(400).send('Game Option is not added in request');
                return;
            }

            if (!userId) {
                // userId
                res.status(400).send('userId is not added in request');
                return;
            }


            // Get App Settings
            const appSetting = await this.appSettings.getAppSettings();

            if (appSetting.lives.enable) {
                // Get Account Info
                const account = await generalAccountService.getAccountById(userId);
                // if lives is less then or equal to 0 then send with error
                if (account.data().lives <= 0) {
                    res.status(403).send('Sorry, don\'t have enough life.');
                    return;
                }
            }

            const gameId = await GameMechanics.createNewGame(gameOptions, userId);

            if (appSetting.lives.enable) {
                // Decrement lives from user account
                generalAccountService.decreaseLife(userId);
                // Decrement Second Player's life
                if (gameOptions.friendId) {
                    generalAccountService.decreaseLife(gameOptions.friendId);
                }
            }
            return res.status(200).send({ gameId: gameId });

        } catch (error) {
            console.error('Error : ', error);
            res.status(500).send('Internal Server error');
            return error;
        }
    }

    /**
     * updateGame
     * return
     */
    static async updateGame(req, res) {
        const gameId = req.params.gameId;
        let dbGame = '';
        const operation = req.body.operation;

        if (!gameId) {
            // gameId
            res.status(400).send('gameId is not added in request');
            return;
        }

        if (!operation) {
            // operation
            res.status(400).send('operation is not added in request');
            return;
        }

        try {

            let game = await GameMechanics.getGameById(gameId);

            if (game.playerIds.indexOf(req.user.uid) === -1) {
                // operation
                res.status(403).send('Unauthorized');
                return;
            }

            const userId = req.user.uid;

            switch (operation) {
                case GameOperations.CALCULATE_SCORE:
                    const currentPlayerQnAs: PlayerQnA = req.body.playerQnA;
                    const qIndex = game.playerQnAs.findIndex((pastPlayerQnA) => pastPlayerQnA.questionId === currentPlayerQnAs.questionId);
                    game.playerQnAs[qIndex] = currentPlayerQnAs;
                    const currentTurnPlayerId = game.nextTurnPlayerId;
                    game.decideNextTurn(currentPlayerQnAs, userId);

                    if (currentPlayerQnAs.answerCorrect) {
                        generalAccountService.setBits(userId);
                    }
                    if (game.nextTurnPlayerId.trim().length > 0 && currentTurnPlayerId !== game.nextTurnPlayerId) {
                        this.pushNotification.sendGamePlayPushNotifications(game, currentTurnPlayerId,
                            pushNotificationRouteConstants.GAME_PLAY_NOTIFICATIONS);
                    }
                    game.turnAt = Utils.getUTCTimeStamp();
                    game.calculateStat(currentPlayerQnAs.playerId);

                    break;
                case GameOperations.GAME_OVER:
                    game.gameOver = true;
                    game.decideWinner();
                    game.calculateStat(game.nextTurnPlayerId);
                    game.GameStatus = GameStatus.COMPLETED;
                    generalAccountService.setBytes(game.winnerPlayerId);
                    if ((Number(game.gameOptions.opponentType) === OpponentType.Random) ||
                        (Number(game.gameOptions.opponentType) === OpponentType.Friend)) {
                        this.pushNotification.sendGamePlayPushNotifications(game, game.winnerPlayerId,
                            pushNotificationRouteConstants.GAME_PLAY_NOTIFICATIONS);
                    }
                    const systemStatsCalculations: SystemStatsCalculations = new SystemStatsCalculations();
                    systemStatsCalculations.updateSystemStats('game_played').then((stats) => {
                        console.log(stats);
                    });
                    break;
                case GameOperations.REPORT_STATUS:
                    const playerQnA: PlayerQnA = req.body.playerQnA;
                    const index = game.playerQnAs.findIndex(
                        playerInfo => playerInfo.questionId === playerQnA.questionId
                    );
                    game.playerQnAs[index] = playerQnA;
                    break;
                case GameOperations.REJECT_GAME:
                    game.gameOver = true;
                    game.GameStatus = GameStatus.REJECTED;
                    const sysStatsCalculations: SystemStatsCalculations = new SystemStatsCalculations();
                    sysStatsCalculations.updateSystemStats('game_played').then((stats) => {
                        console.log(stats);
                    });
                    break;
                case GameOperations.UPDATE_ROUND:
                    game = GameMechanics.updateRound(game, userId);
                    break;
            }
            dbGame = game.getDbModel();

            await GameMechanics.UpdateGame(dbGame);
            return res.status(200).send({});

        } catch (error) {
            console.error('Error : ', error);
            res.status(500).send('Internal Server error');
            return error;
        }
    }

    /**
     * updateAllGame
     * return status
     */
    static async updateAllGame(req, res) {
        try {

            const snapshot = await GameService.getLiveGames();
            for (const doc of snapshot) {

                const game = Game.getViewModel(doc.data());

                game.playerIds.forEach((playerId) => {
                    game.calculateStat(playerId);
                });

                const date = new Date(new Date().toUTCString());
                const millis = date.getTime() + (date.getTimezoneOffset() * 60000);
                game.turnAt = millis;

                const dbGame = game.getDbModel();
                dbGame.id = doc.id;

                await GameService.setGame(dbGame);
            }
            return res.status(200).send('loaded data');

        } catch (error) {
            console.error('Error : ', error);
            res.status(500).send('Internal Server error');
            return error;
        }
    }

    /**
     * createSocialContent
     * return htmlcontent
     */
    static async createSocialContent(req, res) {

        let websiteUrl = `https://`;

        if (functions.config().elasticsearch &&
            functions.config().elasticsearch.index &&
            functions.config().elasticsearch.index.production &&
            functions.config().elasticsearch.index.production === 'true') {
            websiteUrl += 'bitwiser.io';
        } else {
            websiteUrl += 'rwa-trivia-dev-e57fc.firebaseapp.com';
        }

        const imageUrl = `${websiteUrl}/app/game/social-image/${req.params.userId}/${req.params.socialId}`;

        const htmlContent = `<!DOCTYPE html>
                               <html>
                                <head prefix="og: http://ogp.me/ns# fb: http://ogp.me/ns/fb#">
                                  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=contain">
                                  <meta property="og:locale" content="en_US" />
                                  <meta property="og:type" content="article" />
                                  <meta property="og:title" content="Bitwiser Game Score">
                                  <meta property="og:description" content="Bitwiser Game Score">
                                  <meta property="og:url"  content="${imageUrl}">
                                  <meta property="og:image" content="${imageUrl}">
                                  <meta name="twitter:card" content="summary_large_image"/>
                                  <meta name="twitter:title" content="Bitwiser Game Score"/>
                                  <meta name="twitter:description" content="Bitwiser Game Score">
                                  <meta name="twitter:site" content="@${websiteUrl}"/>
                                  <meta name="twitter:image" content="${imageUrl}"/>
                                </head>
                                <body>
                                 <img src="${imageUrl}" />
                                </body>
                              </html>`;

        res.setHeader('content-type', 'text/html');
        return res.status(200).send(htmlContent);
    }

    /**
     * createSocialImage
     * return file
     */
    static async createSocialImage(req, res) {
        try {
            const socialId = req.params.socialId;
            const social_url = await socialGameService.generateSocialUrl(req.params.userId, socialId);
            res.setHeader('content-disposition', 'attachment; filename=social_image.png');
            res.setHeader('content-type', 'image/png');
            return res.status(200).send(social_url);
        } catch (error) {
            console.error('Error : ', error);
            res.status(200, 'Internal Server error');
            return error;
        }
    }

}

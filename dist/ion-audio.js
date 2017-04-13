/*
ionic-audio v1.3.1
 
Copyright 2016 Ariel Faur (https://github.com/arielfaur)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
angular.module('ionic-audio', ['ionic']);

angular.module('ionic-audio').filter('time', function () {
	var addLeadingZero = function(n) {
        return (new Array(2).join('0')+n).slice(-2)
    };

    return function(input) {
        input = input || 0;
        var t = parseInt(input);
        return addLeadingZero(Math.floor(t / 60)) + ':' + addLeadingZero(t % 60);
    };
});
angular.module('ionic-audio').filter('duration', ['$filter', function ($filter) {
    return function (input) {
        return (input > 0) ? $filter('time')(input) : '';
    };
}]);
angular.module('ionic-audio').factory('MediaManager', ['$interval', '$timeout', '$window', '$rootScope', 'Player', 'ListenLater', '$localStorage', '_', 'Analytics',    function ($interval, $timeout, $window, $rootScope, Player, ListenLater, $localStorage, _, Analytics) {
    var tracks = [], currentTrack, currentMedia, playerTimer;
    var isSeek = true;
    var isSet = false;

    if (!$window.cordova && !$window.Media) {
        console.log("ionic-audio: missing Cordova Media plugin. Have you installed the plugin? \nRun 'ionic plugin add cordova-plugin-media'");
        return null;
    }

    return {
        add: add,
        play: play,
        pause: pause,
        stop: stop,
        seekTo: seekTo,
        destroy: destroy,
        getCurrentTimePosition:getCurrentTimePosition,
        customPlay:customPlay,
        customRelease:customRelease,

    };

    function find(track) {
        if (track.id < 0) return;

        var replaceTrack = tracks.filter(function(localTrack) {
            return localTrack.id == track.id;
        }).pop();

        if (replaceTrack) {
            tracks.splice(replaceTrack.id, 1, track);
        }
        return replaceTrack;
     }

    /*
    Creates a new Media from a track object
     var track = {
         url: 'https://s3.amazonaws.com/ionic-audio/Message+in+a+bottle.mp3',
         artist: 'The Police',
         title: 'Message in a bottle',
         art: 'img/The_Police_Greatest_Hits.jpg'
     }
     */

    function customPlay () {
    	resume();
    }

    function add(track, playbackSuccess, playbackError, statusChange, progressChange) {
        console.log('135...', track);
        if (!track.url) {
            console.log('ionic-audio: missing track url');
            return;
        }

        angular.extend(track, {
            onSuccess: playbackSuccess,
            onError: playbackError,
            onStatusChange: statusChange,
            onProgress: progressChange,
            status: 0,
            duration: -1,
            progress: 0
        });

        createMusicControls(track);

        if (find(track)) {
            return track.id;
        }

        track.id  = tracks.push(track) - 1;
        return track.id;
    }

    function play(trackID) {


//    	console.log(trackID);


        if (!angular.isNumber(trackID) || trackID > tracks.length - 1) return;

        // avoid two tracks playing simultaneously
//        console.log(currentTrack);
        if (currentTrack) {
            if (currentTrack.id == trackID) {
                if (currentTrack.status == Media.MEDIA_RUNNING) {

                    pause();
                } else {
                    //if (currentTrack.status == Media.MEDIA_PAUSED) {

                        resume();

                    //}
                }
                return;
            } else {
                if (currentTrack.id > -1) {
                    stop();

                }
            }
        }

        $timeout(function() {
            playTrack(tracks[trackID]);
        }, 300);
    }

    function pause() {
//        console.log('ionic-audio: pausing track '  + currentTrack.title);

        currentMedia.pause();
        stopTimer();

        $rootScope.customPlayEnable = true;
        $rootScope.genericPlayEnable = true;
        MusicControls.updateIsPlaying(false); // toggle the play/pause notification button
        // MusicControls.updateDismissable(false);





    }

    function seekTo(pos) {
        if (!currentMedia) return;

        currentMedia.seekTo(pos * 1000);
        if(Player.setRate != null){
        	currentMedia.setRate(Player.setRate);
        }
    }

    function destroy() {
        stopTimer();
        releaseMedia();
    }

    function customRelease () {

        currentMedia.release();
        currentMedia = undefined;
        currentTrack = undefined;
        MusicControls.destroy();
    }


    function playTrack(track) {

        currentTrack = track;

        //console.log('ionic-audio: playing track ' + currentTrack.title);
        currentMedia = createMedia(currentTrack);
//        console.log(currentMedia);
        currentMedia.play();

        startTimer();

        $rootScope.customPlayEnable = false;
        $rootScope.genericPlayEnable = false;




    }

    function resume() {
//        console.log('ionic-audio: resuming track ' + currentTrack.title);
        currentMedia.play();
        if(Player.setRate != null){
        	currentMedia.setRate(Player.setRate);
        }
        startTimer();
        $rootScope.customPlayEnable = false;
        $rootScope.genericPlayEnable = false;
        MusicControls.updateIsPlaying(true); // toggle the play/pause notification button
        // MusicControls.updateDismissable(false);

    }

    function stop() {
        if (currentMedia){
//            console.log('ionic-audio: stopping track ' + currentTrack.title);
            currentMedia.stop();    // will call onSuccess...
            $rootScope.customPlayEnable = true;
            $rootScope.genericPlayEnable = true;
            MusicControls.destroy();

        }
    }

    function createMedia(track) {
        if (!track.url) {
//            console.log('ionic-audio: missing track url');
            return undefined;
        }

        return new Media(track.url,
            angular.bind(track, onSuccess),
            angular.bind(track, onError),
            angular.bind(track, onStatusChange));
    }

    function releaseMedia() {
        if (angular.isDefined(currentMedia)) {
            currentMedia.release();
            currentMedia = undefined;
            currentTrack = undefined;
            $rootScope.customPlayEnable = true;
            $rootScope.genericPlayEnable = true;
            MusicControls.destroy();

        }
    }

    function onSuccess() {
        stopTimer();
        releaseMedia();

        if (angular.isFunction(this.onSuccess))
            this.onSuccess();
    }

    function onError() {
        if (angular.isFunction(this.onError))
            this.onError();
    }

    function onStatusChange(status) {

        // console.log(322);
        // console.log(status+' :: '+$rootScope.customPlayEnable);
        this.status = status;
        Player.currentMediaStatus = status;

        if($rootScope.customPlayEnable == false && status == 4) {
            ListenLater.removeListenLater(Player.feedId);

            // delete the song from audio_play
            // Player.deleteAudio(Player.feedId).then(function (res) {
            //     // console.log(res);
            // }, function(error) {

            //     // console.log(error);

            // });
            // check if user set play list playing so play the next song for same

            Analytics.tagEvent('Episode Played', {"EpisodeId":Player.feedId,"Episode Name":Player.title,"Media Length":Player.totalTrackDuration, "Time Played":Player.totalTrackDuration,"Percent Played":100,"Did Pause":"no","Completed":"yes", "Did Next":"no"},0);

           if ($localStorage.currentPlaylistListining) {

             var index = _.findIndex($localStorage.currentPlaylistListining, {
                        id: Player.feedId
                    });
                if(index !== -1) {
                    if($localStorage.currentPlaylistListining [index+1]) {
                         Player.url = null;
                         Player.title = null;
                         Player.album = null;
                         Player.imageUrl = null;
                         Player.feedId = null;
                         Player.feed = null;

                         Player.url = $localStorage.currentPlaylistListining [index+1].audio.url;
                         Player.title = $localStorage.currentPlaylistListining [index+1].title;
                         Player.album = $localStorage.currentPlaylistListining [index+1].ministry.name;
                         Player.feedId = $localStorage.currentPlaylistListining [index+1].id;
                         Player.feed = $localStorage.currentPlaylistListining [index+1];
                         Player.imageUrl = $localStorage.currentPlaylistListining [index+1].image.url;
                         $rootScope.changeNewFeedDetail ($localStorage.currentPlaylistListining [index+1]);
                         $rootScope.playAudio('newPlay');

                    }

                }
            }
        }




       console.log("status is"+status);
       console.log("Media.MEDIA_RUNNING is " + Media.MEDIA_RUNNING);

        if(Media.MEDIA_RUNNING == status) {

//        	console.log('inside status');
//        	console.log(Player.seekTo);


        	 if(Player.seekTo) {
//        		console.log('inside seekTo');
        		currentMedia.pause();
         		setTimeout(function() {
         			currentMedia.seekTo(Player.seekTo* 1000);
             		currentMedia.play();
             		Player.seekTo = null;
         		}, 3000)
             }
        }

        if (angular.isFunction(this.onStatusChange))
            this.onStatusChange(status);
    }

    function stopTimer() {
        if (angular.isDefined(playerTimer)) {
            $interval.cancel(playerTimer);
            playerTimer = undefined;
        }
    }

    function getCurrentTimePosition() {

    	 return currentMedia;

    }

    function startTimer() {
        if ( angular.isDefined(playerTimer) ) return;

        if (!currentTrack) return;

        playerTimer = $interval(function() {
            if ( currentTrack.duration < 0){
                currentTrack.duration = currentMedia.getDuration();
            }

            currentMedia.getCurrentPosition(
                // success callback
                function(position) {
                    if (position > -1) {
                        currentTrack.progress = position;
                    }
                },
                // error callback
                function(e) {
                    console.log("Error getting pos=" + e);
                });

            if (angular.isFunction(currentTrack.onProgress)){
                currentTrack.onProgress(currentTrack.progress, currentTrack.duration);
//                console.log('274...', currentTrack.progress, currentTrack.duration);
                updateDurationMusicControl(currentTrack.progress, currentTrack.duration);
            }


        }, 1000);
    }

    function updateDurationMusicControl(elapsed, duration) {
        // console.log(duration > 0 , elapsed > 0 , isSet == false);
        // console.log(duration + " -- " + elapsed + " -- " + isSet);
        // if(duration > 0 && elapsed > 0 && isSet == 0){
            // console.log(286, duration, elapsed);
            MusicControls.update({
                duration: duration,
                elapsed: elapsed
            });
        //     isSet = true;
        // }
    }
    function createMusicControls(track) {
//        console.log('299....', JSON.stringify(track));

        MusicControls.create({
            track: track.title,        // optional, default : ''
            artist: track.album,                     // optional, default : ''
            cover: track.imageUrl,      // optional, default : nothing
            // cover can be a local path (use fullpath 'file:///storage/emulated/...', or only 'my_image.jpg' if my_image.jpg is in the www folder of your app)
            //           or a remote url ('http://...', 'https://...', 'ftp://...')
            isPlaying: true,                           // optional, default : true
            dismissable: true,                         // optional, default : false

            // hide previous/next/close buttons:
            hasPrev: false,      // show previous button, optional, default: true
            hasNext: false,      // show next button, optional, default: true
            hasClose: true,       // show close button, optional, default: false

            // iOS only, optional
            album: '',     // optional, default: ''
            duration: track.duration, // optional, default: 0
            elapsed: 0, // optional, default: 0

            // Android only, optional
            // text displayed in the status bar when the notification (and the ticker) are updated
            ticker: 'Now playing "' + track.title + '"'
        }, function (a, b, c) {
            console.log('a,b,c');
            console.log(a, b, c)
        }, function (a, b, c) {
            console.log('Fa,b,c');
            console.log(a, b, c)
        });

        function events(action) {
//            console.log(140);
//            console.log(action);
            switch (action) {
                case 'music-controls-next':
                    // Do something
                    break;
                case 'music-controls-previous':
                    // Do something
                    break;
                case 'music-controls-pause':
                    pause();
                    MusicControls.updateIsPlaying(false);
                    break;
                case 'music-controls-play':
                    resume();
                    MusicControls.updateIsPlaying(true);
                    break;
                case 'music-controls-destroy':
                    stop();
                    break;

                // External controls (iOS only)
                case 'music-controls-toggle-play-pause':
                    if(currentTrack.status == Media.MEDIA_RUNNING){
                        pause();
                        MusicControls.updateIsPlaying(false);
                    }else if(currentTrack.status == Media.MEDIA_PAUSED){
                        resume();
                        MusicControls.updateIsPlaying(true);
                    }
                    break;

                // Headset events (Android only)
                case 'music-controls-media-button':
                    // if(currentTrack.status == Media.MEDIA_RUNNING){
                    //     pause();
                    //     MusicControls.updateIsPlaying(false);
                    // }else if(currentTrack.status == Media.MEDIA_PAUSED){
                    //     resume();
                    //     MusicControls.updateIsPlaying(true);
                    // }
                    break;
                case 'music-controls-headset-unplugged':
                    // Do something
                    break;
                case 'music-controls-headset-plugged':
                    // Do something
                    break;
                default:
                    break;
            }
        }

        // Register callback
        MusicControls.subscribe(events);

        // Start listening for events
        // The plugin will run the events function each time an event is fired
        MusicControls.listen();
    }
}]);
angular.module('ionic-audio').directive('ionAudioTrack', ['MediaManager', '$rootScope', 'Player',  ionAudioTrack]);

function ionAudioTrack(MediaManager, $rootScope, Player) {
    return {
        transclude: true,
        template: '<ng-transclude></ng-transclude>',
        restrict: 'E',
        scope: {
            track: '=',
            togglePlayback: '='
        },
        require: 'ionAudioTrack',
        link: link,
        controller: ['$scope', '$element', ionAudioTrackCtrl]
    };

    function link(scope, element, attr, controller) {
        controller.hasOwnProgressBar = element.find('ion-audio-progress-bar').length > 0
    }

    function ionAudioTrackCtrl($scope, $element) {
        var controller = this;

        var checkeTrackDefaulutValue = 0;



        var init = function(newTrack, oldTrack) {
            if (!newTrack || !newTrack.url) return;

            newTrack.progress = 0;
            newTrack.status = 0;
            newTrack.duration = -1;
            if (oldTrack && oldTrack.id !== undefined) newTrack.id = oldTrack.id;

            if (MediaManager) {
                MediaManager.add(newTrack, playbackSuccess, null, statusChange, progressChange);
            }
        };

        var playbackSuccess = function() {
            $scope.track.status = 0;
            $scope.track.progress = 0;
        };
        var statusChange = function(status) {
            $scope.track.status = status;
        };
        var progressChange = function(progress, duration) {
            $scope.track.progress = progress;


            if(Player.feedTrackTime == $scope.track.progress) {
            	checkeTrackDefaulutValue ++;
            	//console.log(checkeTrackDefaulutValue);
            	if(checkeTrackDefaulutValue > 15) {

            		var currentMedia = MediaManager.getCurrentTimePosition();
                    //console.log(currentMedia);
                    if (currentMedia) {
                    	console.log('play');
                        MediaManager.customPlay();
                        checkeTrackDefaulutValue = 0;
                     }


            	}
            }
            Player.feedTrackTime = $scope.track.progress;
            Player.trackingFeedId = Player.feedId;
            //console.log($scope.track.progress);
            //console.log($scope.track.status);
            $scope.track.duration = duration;
            Player.totalTrackDuration = duration;

            //console.log($scope.track.duration);

        };
        var notifyProgressBar = function() {

            $rootScope.$broadcast('ionic-audio:trackChange', $scope.track);
        };

        this.seekTo = function(pos) {
            MediaManager.seekTo(pos);
        };

        this.getTrack = function() {
            return $scope.track;
        };

        this.start = function() {
            if (!$scope.track || !$scope.track.url) return;

            MediaManager.play($scope.track.id);

            // notify global progress bar if detached from track
            if (!controller.hasOwnProgressBar) notifyProgressBar();

            return $scope.track.id;
        };

        var unbindWatcher = $scope.$watch('track', function(newTrack, oldTrack) {
            if (newTrack === undefined) return;
            MediaManager.stop();
            init(newTrack, oldTrack);
        });

        $scope.$on('$destroy', function() {
            unbindWatcher();
            MediaManager.destroy();
            console.log(546);
        });
    }
}
angular.module('ionic-audio').directive('ionAudioProgress', ionAudioProgress);

function ionAudioProgress() {
    return {
        restrict: 'E',
        scope: {
            track: '='
        },
        template: '{{track.progress | time}}'
    }
}
angular.module('ionic-audio').directive('ionAudioProgressBar', ['MediaManager', '$rootScope',  ionAudioProgressBar]);

function ionAudioProgressBar(MediaManager, $rootScope) {
    return {
        restrict: 'E',
        scope: {
            track: '=?'
        },
        template:
            '<h2 class="ion-audio-track-info" ng-style="displayTrackInfo()">{{track.title}} - {{track.artist}}</h2>' +
            '<div class="" ng-class="checkPlayerStatus()">' +
            '<ion-audio-progress track="track"></ion-audio-progress>' +
            '<input type="range" name="volume" min="0" max="{{track.duration}}" ng-model="track.progress" on-release="sliderRelease()" disabled>' +
            '<ion-audio-duration track="track"></ion-audio-duration>' +
            '</div>',
        link: link
    };

    function link(scope, element, attrs) {


        var slider =  element.find('input'), unbindTrackListener;

        function init() {
            //scope.track.progress = 0;
            //scope.track.status = 0;
            //scope.track.duration = -1;
        }

        if (!angular.isDefined(attrs.displayTime)) {
            element.find('ion-audio-progress').remove();
            element.find('ion-audio-duration').remove();
        }
        if (!angular.isDefined(attrs.displayInfo)) {
            element.find('h2').remove();
        }

        if (angular.isUndefined(scope.track)) {
            scope.track = {};

            // listens for track changes elsewhere in the DOM
            unbindTrackListener = scope.$on('ionic-audio:trackChange', function (e, track) {
                scope.track = track;
            });
        }

        // disable slider if track is not playing
        var unbindStatusListener = scope.$watch('track.status', function(status) {
            // disable if track hasn't loaded

            slider.prop('disabled', status == 0);   //   Media.MEDIA_NONE
        });


        // hide/show track info if available
        scope.displayTrackInfo = function() {
            return { visibility: angular.isDefined(attrs.displayInfo) && angular.isDefined(scope.track) && (scope.track.title || scope.track.artist) ? 'visible' : 'hidden'}
        };
         scope.checkPlayerStatus = function() {

            if($rootScope.isMediaEnable == true) {
                return 'range1 range-assertive1'
            }
            else
                return 'range1 range-assertive1';

            console.log($rootScope);
        };

        // handle track seek-to
        scope.sliderRelease = function() {
            var pos = scope.track.progress;
//            console.log(pos);
            MediaManager.seekTo(pos);
        };

        scope.$on('$destroy', function() {

            unbindStatusListener();
            if (angular.isDefined(unbindTrackListener)) {
                unbindTrackListener();
            }
        });

        init();
    }
}
angular.module('ionic-audio').directive('ionAudioPlay', ['$ionicGesture', '$timeout', ionAudioPlay]);

function ionAudioPlay($ionicGesture, $timeout) {
    return {
        restrict: 'A',
        require: '^^ionAudioControls',
        link: link
    };

    function link(scope, element, attrs, controller) {
        var isLoading, debounce, currentStatus = 0;

        var init = function() {
            isLoading = false;
            element.addClass('ion-play');
            element.removeClass('ion-pause');
            element.text(attrs.textPlay);
        };

        var setText = function() {
            if (!attrs.textPlay || !attrs.textPause) return;

            element.text((element.text() == attrs.textPlay ? attrs.textPause : attrs.textPlay));
        };

        var togglePlaying = function() {
            element.toggleClass('ion-play ion-pause');
            setText();
        };

        $ionicGesture.on('tap', function() {
            // debounce while loading and multiple clicks
            if (debounce || isLoading) {
                debounce = false;
                return;
            }

            if (currentStatus == 0) isLoading = true;

            controller.play();
            togglePlaying();
        }, element);

        $ionicGesture.on('doubletap', function() {
            debounce = true;
        }, element);

        var unbindStatusListener = scope.$parent.$watch('track.status', function (status) {
            //  Media.MEDIA_NONE or Media.MEDIA_STOPPED
            if (status == 0 || status == 4) {
                init();
            } else if (status == 2) {   // Media.MEDIA_RUNNING
                isLoading = false;
            }

            currentStatus = status;
        });

        var unbindPlaybackListener = scope.$parent.$watch('togglePlayback', function (newPlayback, oldPlayback) {
            if (newPlayback == oldPlayback) return;
            $timeout(function() {
                togglePlaying();
                controller.play();
            },300)
        });

        init();

        scope.$on('$destroy', function() {
            unbindStatusListener();
            unbindPlaybackListener();
        });
    }
}
angular.module('ionic-audio').directive('ionAudioDuration', ionAudioDuration);

function ionAudioDuration() {
    return {
        restrict: 'E',
        scope: {
            track: '='
        },
        template: '{{track.duration | duration}}'
    }
}
angular.module('ionic-audio').directive('ionAudioControls', function() {
    return {
      restrict: 'EA',
      require: ['ionAudioControls', '^^ionAudioTrack'],
      controller: ['$scope', '$element', ionAudioControlsCtrl],
      link: link
    };

function ionAudioControlsCtrl($scope, $element) {
        var spinnerElem = $element.find('ion-spinner'), hasLoaded, self = this;

        spinnerElem.addClass('ng-hide');

        this.toggleSpinner = function() {
          spinnerElem.toggleClass('ng-hide');
        };

        this.play = function() {
          if (!hasLoaded) {
              self.toggleSpinner();
          }
          this.start();
        };

        var unbindStatusListener = $scope.$parent.$watch('track.status', function (status) {
            switch (status) {
              case 1: // Media.MEDIA_STARTING
                  hasLoaded = false;
                  break;
              case 2: // Media.MEDIA_RUNNING
                  if (!hasLoaded) {
                      self.toggleSpinner();
                      hasLoaded = true;
                  }
                  break;
              //case 3: // Media.MEDIA_PAUSED
              //    break;
              case 0: // Media.MEDIA_NONE
              case 4: // Media.MEDIA_STOPPED
                  hasLoaded = false;
                  break;
            }
        });

        $scope.$on('$destroy', function() {
          unbindStatusListener();
        });
    }

    function link(scope, element, attrs, controllers) {
        controllers[0].start = controllers[1].start;
    }
});
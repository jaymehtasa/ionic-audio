angular.module('ionic-audio').factory('MediaManager', ['$interval', '$timeout', '$window', '$rootScope', 'Player',  function ($interval, $timeout, $window, $rootScope, Player) {
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



    }

    function seekTo(pos) {
        if (!currentMedia) return;

        currentMedia.seekTo(pos * 1000);
    }

    function destroy() {
        stopTimer();
        releaseMedia();
    }


    function playTrack(track) {

        currentTrack = track;

        //console.log('ionic-audio: playing track ' + currentTrack.title);

        currentMedia = createMedia(currentTrack);
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
        this.status = status;

        console.log("status is"+status);
        console.log("Media.MEDIA_RUNNING is " + Media.MEDIA_RUNNING);

        if(Media.MEDIA_RUNNING == status) {

        	console.log('inside status');
        	console.log(Player.seekTo);


        	 if(Player.seekTo) {
        		console.log('inside seekTo');
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
                console.log('274...', currentTrack.progress, currentTrack.duration);
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
        console.log('299....', JSON.stringify(track));

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
            console.log(140);
            console.log(action);
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
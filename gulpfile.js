var gulp        = require("gulp");
var gulpif      = require('gulp-if');
var gutil       = require("gulp-util");
var cleanhtml   = require('gulp-cleanhtml');
var minifyCSS   = require('gulp-minify-css');
var htmlreplace = require('gulp-html-replace');
var rename      = require("gulp-rename");
var compression = require("compression")
var express     = require("express");
var source      = require('vinyl-source-stream');
var path        = require("path");
var open        = require("open");
var livereload  = require('gulp-livereload');
var browserify  = require('browserify');
var uglify      = require('gulp-uglify');
var streamify   = require('gulp-streamify');

var port        = 3080;

var websrc = './frontend';
var dist = './build';

var isProduction = process.env.NODE_ENV === 'production';

gulp.task('minify-css', function() {
    return gulp.src(websrc + '/css/*.css')
        .pipe(gulpif(isProduction, minifyCSS({keepSpecialComments: 0})))
        .pipe(rename('app.css'))
        .pipe(gulp.dest(dist + '/css'));
});

gulp.task('browserify', function() {
  var bundler = browserify({
    // Add file extentions to make optional in your requires
    entries: [websrc + '/js/app.jsx'],
    extensions: ['.jsx'],
    debug: !isProduction
  });
  bundler.transform(["reactify", {"es6": true}]);

  return bundler.bundle()
  .pipe(source('app.js'))
  .pipe(gulpif(isProduction, streamify(uglify())))
  .pipe(gulp.dest(dist + '/js'));
});

gulp.task('copy-images', function(){
  return gulp.src(websrc + '/images/*.*')
    .pipe(gulp.dest(dist + '/images/'));
});

gulp.task('copy-favicon', function() {
  return gulp.src(websrc + '/favicon.ico')
    .pipe(gulp.dest(dist));
});

gulp.task('copy-htaccess', function() {
  return gulp.src(websrc + '/htaccess')
    .pipe(rename('.htaccess'))
    .pipe(gulp.dest(dist));
});

gulp.task('copy-fonts', function() {
  return gulp.src(websrc + '/font/*')
    .pipe(gulp.dest(dist + '/font'));
});

gulp.task('clean-html', function(){
  return gulp.src(websrc + '/*.html')
    .pipe(htmlreplace({
        'css': 'app.css',
        'js' : 'app.js'
    }))
    .pipe(gulpif(isProduction, cleanhtml()))
    .pipe(gulp.dest(dist));
});

gulp.task('watch', function(){
    livereload.listen();
    gulp.watch(websrc + '/js/*.jsx', ['browserify']);
    gulp.watch(websrc + '/css/*.css', ['minify-css']);
    gulp.watch(websrc + '/*.html', ['clean-html']);

});

var createServer = function(port) {
    var p = path.resolve(dist);
    var app = express();
    app.use(compression());
    app.use(express.static(p));
    app.listen(port, function() {
        gutil.log("Listening on", port);
    });

    return {
        app: app
    };
};

gulp.task('build', ['minify-css', 'browserify', 'clean-html', 'copy-images', 'copy-favicon', 'copy-htaccess', 'copy-fonts']);

gulp.task("server", ['build'], function(){
    createServer(port);
    open( "http://localhost:" + port + "/index.html" );
});

gulp.task('default', ['server', 'watch']);

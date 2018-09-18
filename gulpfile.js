const gulp = require('gulp-param')(require('gulp'), process.argv);
const cheerio = require('gulp-cheerio');
const fs = require('fs');
const scrape = require('website-scraper');
const modifyCssUrls = require('gulp-modify-css-urls');
const del = require('del');
const exec = require('child_process').exec;
const phantomHtml = require('website-scraper-phantom');
const cleanCSS = require('gulp-clean-css');
const rework = require('gulp-rework');
var through = require('through2');



gulp.task('default', ['remove-data-sets']);


gulp.task('make-new-branding-skeleton', function (url) {
  return gulp.src(['branding_files/**/*']).
  pipe(gulp.dest('branding'))
})

gulp.task('get-website', ['make-new-branding-skeleton'], function (url, cb) {
  if (!checkURLRegex(url)) {
    console.log('Invalid url');
  } else {
    let urlArray = url.split('/');
    let websitename = urlArray[2];
    return scrape({
      urls: [url],
      directory: `downloads/${websitename}`,
      httpResponseHandler: phantomHtml,
      ignoreErrors: true,
      subdirectories: [{
          directory: '../../branding/theme',
          extensions: ['.jpg', '.png', '.woff', '.woff2', '.css', '.gif']
        },
        {
          directory: '/delete',
          extensions: ['.js', '.orig', '.ttf', '.eot']
        },
        {
          directory: '/svg',
          extensions: ['.svg']
        },
        {
          directory: '../../branding/',
          extensions: ['.html', '.htm']
        }
      ]
    }).then(function () {
      fs.writeFile('branding/info.txt', url, function (err) {
        if (err) throw err
      });

      fs.rename('branding/index.html', 'branding/template.htm', function (err) {
        if (err) console.log('ERROR: ' + err);
      });
    }).catch(function(err, cb){
      if (err) throw err;
    });
  }
});

gulp.task('strip-html', ['get-website'], function (cb) {
  return gulp
    .src(['branding/*.htm', 'branding/*.html'])
    .pipe(cheerio(function ($, file, done) {
      let invalidData = {
        tags: ['script', 'noscript', ' meta', 'iframe', 'input'],
        attributes: ['itemprop', 'lang', 'aria-label', 'itemscope', 'itemtype', 'onclick', 'onchange', 'onmouseover', 'onmouseout', 'onkeydown', 'onload', 'aria-controls'],
      }

      for (items in invalidData) {
        if (invalidData.hasOwnProperty(items)) {
          if (items === 'tags') {
            let badTags = invalidData[items];
            for (let i = 0; i < badTags.length; i++) {
              if (badTags[i] !== 'meta') {
                $(badTags[i]).each(function (i, elem) {
                  $(this).remove();
                })
              } else {
                $(badTags[i]).not(['charset']).each(function (i, elem) {
                  $(this).remove();
                });
              }
            }
          }
          if (items === 'attributes') {
            let badAttributes = invalidData[items];
            for (let i = 0; i < badAttributes.length; i++) {
              $('*').each(function (i, elem) {
                $(this).removeAttr(badAttributes[i]);
              })
            }
          }
        }
      }
      done();
    }))
    .pipe(gulp.dest('branding/'));
});

gulp.task('extract-css', ['strip-html'], function (cb) {
  return gulp
    .src(['branding/*.htm', 'branding/*.html'])
    .pipe(cheerio(function ($, file, done) {
      if ($('style').length > 0) {
        $('style').each(function (i, elem) {
          let string = $(this).text();
          let ws = fs.createWriteStream('branding/theme/inlineStyle.css', {
            'flags': 'a'
          });
          ws.write(string);
          ws.on('finish', function () {
            console.log('style extracted');
          });
          ws.end();
          $(this).remove();
        });

        $('head').append('<link rel="stylesheet" href="theme/inlineStyle.css" type="text/css" media="all">')
      }
      done();
    }))
    .pipe(gulp.dest('branding/'));
});

gulp.task('fix-links', ['extract-css'], function (url) {
  return gulp
    .src(['branding/*.htm', 'branding/*.html'])
    .pipe(cheerio(function ($, file, done) {
      $('a').each(function (i, elem) {
        console.log($(this).attr('href'));
        let hrefUrl = $(this).attr('href');
        if (hrefUrl == undefined) {
          $(this).attr('href', url);
          hrefUrl = $(this).attr('href');
          console.log(hrefUrl);
        }

        if (hrefUrl === 'index.html' || hrefUrl === 'index.html#' || hrefUrl === '#') {
          $(this).attr('href', url);
        }

        if ((hrefUrl.indexOf('tel') !== undefined || hrefUrl.indexOf('mailto') !== undefined) && (hrefUrl.indexOf('tel') !== -1 || hrefUrl.indexOf('mailto') !== -1)) {
          $(this).remove();
        }
      });
      done();

    }))
    .pipe(gulp.dest('branding/'));
});

gulp.task('fix-css-links', ['fix-links'], function (cb) {
  return gulp
    .src(['branding/*.htm', 'branding/*.html'])
    .pipe(cheerio(function ($, file, done) {
      $('link').each(function (i, elem) {
        let re = /^(.(.*\.css))*$/
        let filepath = $(this).attr('href');
        if (!filepath.match(re)) {
          $(this).remove();
        } else {
          let url = $(this).attr('href').split('/');
          let filename = url[url.length - 1];
          let removeVersion = filename.split('@');
          let cleanFilename = removeVersion[0];
          console.log(filename);
          $(this).attr('href', `theme/${cleanFilename}`)
        }
      });
      done();
    }))
    .pipe(gulp.dest('branding/'));
});

gulp.task('fix-img-src', ['fix-css-links'], function (cb) {
  return gulp
    .src(['branding/*.htm', 'branding/*.html'])
    .pipe(cheerio(function ($, file, done) {
      $('img').each(function (i, elem) {
        let srcUrl = $(this).attr('src');
        if(srcUrl !== undefined) {
          let urlArray = srcUrl.split('/');
          let fileName = urlArray[urlArray.length - 1];
          $(this).attr('src', 'theme/' + fileName);
        }
      });
      done();
    }))
    .pipe(gulp.dest('branding/'));
});

gulp.task('clean-css', ['fix-img-src'], function (cb) {
  return gulp.src('branding/theme/*.css')
    .pipe(cleanCSS({
      format: 'keep-breaks',
      inline: ['all'],
      level: 2
    }))
    .pipe(gulp.dest('branding/theme'));
});

gulp.task('modify-css-urls', ['clean-css'], function (cb) {
  return gulp.src(['branding/theme/*.css'])
    .pipe(modifyCssUrls({
      modify: function (cssurl, filePath) {
        let urlArray = cssurl.split('/');
        let fileName = urlArray[urlArray.length - 1]

        return fileName;
      }
    }))
    .pipe(gulp.dest('branding/theme'));
});

gulp.task('remove-dropdowns', ['modify-css-urls'], function (cb) {
  return gulp
    .src(['branding/*.htm', 'branding/*.html'])
    .pipe(cheerio(function ($, file, done) {
      $('li').children('ul').each(function (i, elem) {
        $(this).remove();
      })
      done();
    }))
    .pipe(gulp.dest('branding/'));
});

gulp.task('remove-data-sets', ['remove-dropdowns'], function (cb) {
  return gulp
    .src(['branding/*.htm', 'branding/*.html'])
    .pipe(cheerio(function ($, file, done) {
      $('*').each(function (i, elem) {
        let dataSet = $(this).data();
        if (Object.keys(dataSet).length !== 0) {
          for (let key in dataSet) {
            let dashed = camelToDash(key);
            console.log(dashed);
            $(this).removeAttr(`data-${dashed}`);
          }
        }
      });
      done();
    }))
    .pipe(gulp.dest('branding/'));
});

gulp.task('save', ['clear-holding-tank'], function (cb) {
  return gulp.src(['branding/**/*']).
  pipe(gulp.dest('holding'))
});


gulp.task('clear-holding-tank', function (cb) {
  return del([
    'holding/**/*'
  ]);
});

gulp.task('start-fresh', function (cb) {
  return del([
    'holding/**/*',
    'downloads/**/*',
    'branding/**/*',
    '!branding/.git',
  ]);
});

gulp.task('reset', function (cb) {
  return gulp.src(['holding/**/*']).
  pipe(gulp.dest('branding'))
});

function camelToDash(str) {
  return str.replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`);
}

function checkURLRegex(url) {
  let re = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g
  return url.match(re)
}

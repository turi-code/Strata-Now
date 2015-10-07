var React = require('react/addons');
var moment = require('moment');
var ReactRouter = require('react-router');
var CustomEvent = require('custom-event');
var bowser = require('bowser');

var PureRenderMixin = React.addons.PureRenderMixin;
// var Perf = React.addons.Perf;

/********* statics ****************/
var PredictiveService = {
  apikey: 'b437e588-0f2b-45e1-81c8-ce3acfa81ade', 
  url: 'http://demolab-one-six-2015364754.us-west-2.elb.amazonaws.com/data/'
};
var storagePrefix = 'stratanow_like_';
/********* / statics **************/

/********* initialization ********/
sp_client("newTracker", "cf", "d13tuqfqntlwqg.cloudfront.net", {
    appId: "cfe23a",
    platform: "web"
});
/********* / initialization ********/

/*********  events **************/

var recommendationLoadEvent = new CustomEvent('recommendationsLoaded');

// Flip intro screen when data is ready.
window.addEventListener('recommendationsLoaded', onFirstLoad, false);

var onFirstLoad = function(e){
  $('#about_overlay .exit').on('click', hideElement.bind(null,'#about_overlay'));
  $('#intro_overlay').one('click', letsGo);
  $('#loading-text').addClass('hidden');
  $('#lets-go').removeClass('hidden');
  // fail-safe in case the progress bar doesn't switch
  setTimeout(letsGo, 7000);
  //only listen once
  window.removeEventListener('recommendationsLoaded',onFirstLoad, false);
};

/********* / events **************/

/****** utility functions ******/
function letsGo(){
  hideElement('#intro_overlay');
  registerFirstVisit();
}

function hideElement(el_selector) {
  $(el_selector).addClass('hidden');
}

function registerFirstVisit() {
  if ('localStorage' in window && window.localStorage !== null) {
    localStorage.setItem("repeatVisit", 'true');
  }
}

function getSpeakerId(speaker) {
  var urlPieces = speaker.url.split('/');
  return urlPieces[urlPieces.length-1];
}

// Account for the top page padding.  Add 20px to clear some whitespace above the item.
var html_padding = 92, jump_padding = 20;
$(function() {
  html_padding = parseInt($('html').css('padding-top'), 10) || 92;
});

function scrollToElement(element_selector) {
  var position = $(element_selector).position();
  if (position) {
    // TODO -- this does not work reliably without setTimeout. Not sure why the
    // timing is like that, but I guess <body> does not have enough scroll
    // height until after componentDidMount?
    setTimeout(function() {
      // need to use 'html' for Firefox, 'body' otherwise
      // (see https://github.com/madrobby/zepto/issues/392)
      var scrollElem = bowser.browser.firefox ? 'html' : 'body';
      $(scrollElem).scrollTop(position.top - html_padding - jump_padding);
    }, 0);
  }
}

// Introduce a heuristic that provides a variable number of recommendations
// based on how many items you have favorited.
// Current heuristic: 1->5, 2->10, 3->13, 4->14, 5->15, with a max of 20
var getHowManyRecsNeeded = function (item_ids) {
  if (item_ids.length <=2 ) {
    return 5 * item_ids.length;
  }
  var how_many = 10 + item_ids.length;
  return Math.min(how_many, 20);
};

var getRecommendationFilterFunction = function(rec_list) {
  var rec_ids = rec_list.map(function(r) { return r.id;});
  return function(item_id) {
    return rec_ids.indexOf(item_id) !== -1;
  };
};

var debounceFunc =  function(func, wait) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = Date.now() - timestamp;

      if (last < wait && last > 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = Date.now();
      if (!timeout) timeout = setTimeout(later, wait);
      return result;
    };
};


var datetime_formats = ["MM/DD/YYYY H:mma", "MM/DD/YYYY Ha"];

// Sort a list of items with custom comparator for dates
var sortItemListByDate = function(items) {
  items.sort(function(a,b) {
    var a_date = moment(a['date'] + ' ' + a['start_time'], datetime_formats);
    var b_date = moment(b['date'] + ' ' + b['start_time'], datetime_formats);

    if (a_date.isAfter(b_date)) {
      return 1;
    }
    if (a_date.isBefore(b_date)) {
      return -1;
    }
    return 0;
  });
};

// Sort a list of items by their returned rank
var sortItemListByRelevancy = function(items) {
  items.sort(function(a,b) {
    if (a.rank > b.rank) {
      return 1;
    }
    if (a.rank < b.rank) {
      return -1;
    }
    return 0;
  });
};


/****** / utility functions ****/

var FocusItem = React.createClass({
  render: function() {
    return (
      <div className="jumbotron">
        <div className="container">
          <div className="row focus">
            {this.props.children}
          </div>
        </div>
      </div>
    );
  }
});

var FocusSpeaker = React.createClass({
  render: function() {
    return (
      <FocusItem>
        <div className="row speaker">
        <div className="col-xs-3">
          <img src={this.props.item.imgsrc} className="img-responsive pull-right" />
        </div>
        <div className="col-xs-9">
          <h2>{this.props.item.name}</h2>
        </div>
      </div>
      <div className="row">
        <div className="spacer"></div>
        <div className="col-xs-12 abstract">
          <p>{this.props.item.bio}</p>
          <p className="speaker-details"><a href={this.props.item.url}>Find more details on this speaker at strataconf.com.</a></p>
        </div>
      </div>
      </FocusItem>
    );
  }
});

var FocusTalk = React.createClass({
  mixins: [PureRenderMixin],
  render: function() {
    var item = this.props.item;
    if (!item) { return <div />; }
    var date = item.dow + ', ' + item.date;
    var time = item.start_time + ' to ' + item.end_time;
    return (
      <FocusItem>
        <div className="row focus-talk">
          <div className="col-xs-11">
            <span className="talk-title">{item.title}</span>
          </div>
        </div>
          <div className="row focus-talk">
            <div className="col-xs-12">
              <div className="row">
                <div className="col-xs-12 col-sm-11 col-md-8">
                  <div className="spacer"></div>
                  <div className="abstract">{item.abstract}</div>
                </div>
              </div>
              <div className="row">
                <div className="col-xs-2 col-sm-2 col-md-1 left-column text-center">
                  <a href="javascript:" onClick={this.props.toggleLike}>
                    <i className={'icon-star' + (this.props.liked ? '' : ' empty')} />
                  </a>
                </div>
                <div className="col-xs-2 col-sm-2 col-md-1 text-center">
                    {ListItem.renderRecommendation(this.props.isRecommended)}
                </div>
                <div className="col-xs-offset-0 col-sm-offset-0 col-xs-8 col-sm-3 col-md-3">

                  <i className="icon-small icon-calendar" />&nbsp;&nbsp;{date}
                    <br />
                  <i className="icon-small icon-clock" />&nbsp;&nbsp;{time}
                    <br />
                  <i className="icon-small icon-location" />&nbsp;&nbsp;{item.room}
                  </div>

                <div className="clearfix visible-xs-block"></div>
                <div className="visible-xs hidden-sm hidden-md hidden-lg spacer"></div>
                <div className="col-xs-6 col-sm-5 col-md-4">
                  <div className="center-block">
                  {ListItem.renderSpeakersTable(this.props.speakers)}
                  </div>
                </div>
                <div className="col-xs-6 col-sm-6">
                  <ul className="list-inline">{this.props.techs}</ul>
                </div>
              </div>
            </div>
              <div className="col-xs-12">
                <p className="details"><a href={item.url}>Find more details on this talk at strataconf.com.</a></p>
              </div>
        </div>
      </FocusItem>
    );
  }
});

var ListItem = React.createClass({
  statics: {
    makeSpeakerLink: function(speaker) {
      if (speaker) {
        return (<ReactRouter.Link to="speaker" params={{speakerId: getSpeakerId(speaker)}}>
          {speaker.name}
        </ReactRouter.Link>);
      }
    return null;
    },
    makeSpeakerTableItem: function(speaker, index) {
      return (
        <td key={index}>
          {ListItem.makeSpeakerLink(speaker)}
        </td>
      );
    },
    renderSpeakersTable: function(speaker_list) {
      var speakers = [];
      var speaker_table = null;
      if (speaker_list.length < 6){
          speakers = speaker_list.map(function(speaker, speaker_index) {
          return (
            <tr key={speaker_index}>
              {ListItem.makeSpeakerTableItem(speaker, speaker_index)}
            </tr>
          );
        });
        speaker_table = (
          <table className="speakers">
            <tbody>
              {speakers}
            </tbody>
          </table>
        );
      } else {
        var speakers_length = speaker_list.length;
        for (var speaker_index = 0; speaker_index < speakers_length; speaker_index += 2 ) {
            if (speaker_index + 1 === speakers_length) {
              speakers.push(
                <tr key={speaker_index}>
                  {ListItem.makeSpeakerTableItem(speaker_list[speaker_index], speaker_index)}
                </tr>
              );
            }
            else {
              speakers.push(
                <tr key={speaker_index}>
                  {ListItem.makeSpeakerTableItem(speaker_list[speaker_index])}{ListItem.makeSpeakerTableItem(speaker_list[speaker_index+1])}
                </tr>
              );
            }
          }
          speaker_table = (
            <table className="speakers">
            <thead>
              <tr>
                <th width="50%"></th>
                <th width="50%"></th>
                </tr>
            </thead>
              <tbody>
                {speakers}
              </tbody>
            </table>
          );
      }
      return speaker_table;
    },
    renderRecommendation: function(isRecommended) {
      return ( isRecommended ?
        <div className="recommended"><i className="icon-thumbs-up" /></div> :
        null
        );
    }
  },
  shouldComponentUpdate: function(nextProps, nextState) {
    return this.props.liked !== nextProps.liked ||
           this.props.isRecommended !== nextProps.isRecommended;
  },
  render: function() {
    var item = this.props.item;
    var techs = (<div/>);
    // var techs = item.tech_tags.map(function(x, idx) {
    //   return (<li key={x}><span className="label label-default">{x}</span></li>);
    // });
    var day = item.dow.slice(0,3);
    var time = item.start_time;
    return (
      <div className="row itemsummary">
        { this.props.jumpHere ?
          <a name="jumpHere" > </a> :
            null
        }
        <div className="col-xs-2 col-sm-1 text-center left-column">
          <a href="javascript:" onClick={this.props.toggleLike}>
            <i className={'icon-star' + (this.props.liked ? '' : ' empty')} />
          </a>
          <div className="datetime day text-center">
          <h4>{day}</h4>
          </div>
          <div className="datetime time text-center">
          <h6>{time}</h6>
          </div>
          {ListItem.renderRecommendation(this.props.isRecommended)}
        </div>
        <div className="col-xs-10 col-sm-11">
          <div className="row">
            <div className="col-xs-12">
              <ReactRouter.Link to="talk" params={{talkId: item.id}}>
                <h4 className="talk-title">{item.title}</h4>
              </ReactRouter.Link>
            </div>
            <div className="col-xs-12 col-sm-5 col-sm-push-7">
                {ListItem.renderSpeakersTable(item.speakers)}
                { /* <ul className="list-inline">{techs}</ul> */ }
            </div>
            <div className="col-xs-12 col-sm-7 col-sm-pull-5">
              <div className="hidden-sm visible-xs spacer"></div>
              <div className="abstract">{item.abstract}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

var PoweredByPredictiveService = function(method, setInput, onSuccess) {
  var loadDataFromServer = function() {
    var storageKey = 'stratanow_predictiveservice_' + method;
    var url = PredictiveService.url + method;
    var data = {
      'api_key': PredictiveService.apikey,
      'data': {'input':{}}
    };
    setInput.bind(this)(data);
    $.ajax({
      url: url,
      dataType: 'json',
      contentType: "application/json; charset=utf-8",
      type: 'POST',
      data: JSON.stringify(data),
      success: function(data) {
        onSuccess.bind(this)(data);
      }.bind(this),
      error: function(xhr, status, err) {
        console.error(url, status, err.toString());
      }.bind(this)
    });
  };
  return {
    componentWillMount: loadDataFromServer
  };
};

var ViewAll = React.createClass({
  componentDidMount: function() {
    scrollToElement('[name=jumpHere]');
  },
  componentDidUpdate: function(prevProps, prevState) {
    var recsLoaded = this.props.recommended.length !== 0 &&
      prevProps.recommended.length === 0;
    var moreItemsLoaded = this.props.items.length !== prevProps.items.length;
    if (recsLoaded || moreItemsLoaded) {
      // only scroll on first recommendation load or more items
      scrollToElement('[name=jumpHere]');
    }
  },
  render: function() {
    var items;
    var item_ids = Object.keys(this.props.items);
    if (item_ids.length > 0) {
      items = item_ids.map(function(key){
        return this.props.items[key];
      }, this);

    var is_Recommended = getRecommendationFilterFunction(this.props.recommended);

    var afterNow = false, jumpHere = false;
    var currentTime = moment();

    items = items.map(function(item, idx) {
      // items are sorted by date
      // at first item that is after the current time, add anchor
      if (afterNow===false && currentTime.isBefore(moment(item.date + " " + item.start_time, datetime_formats))){
        afterNow = true;
        jumpHere = true;
      } else if (jumpHere === true){
        // then stop adding anchor
        jumpHere = false;
      }
      return [
        <ListItem
          item={item}
          key={item.id}
          jumpHere={jumpHere}
          toggleLike={this.props.toggleLike.bind(null, item.id, this.props.uuid)}
          liked={this.props.likes.indexOf(item.id) !== -1}
          isRecommended={is_Recommended(item.id)}
        />,
      <hr className="item-divider" key={idx + 'hr'} />
      ];
    }, this);
    }
    return (
      <div>
        {items}
      </div>
    );
  }
});

var ViewRecommended = React.createClass({
  componentDidMount: function() {
    window.dispatchEvent(recommendationLoadEvent);
    scrollToElement('[name=jumpHere]');
  },
  componentDidUpdate: function(prevProps, prevState) {
    if (this.props.recommended.length !== 0 &&
        prevProps.recommended.length === 0) {
      // only scroll on first recommendation load
      scrollToElement('[name=jumpHere]');
    }
  },
  render: function() {
    var items = this.props.recommended.map(function(item) { return item.data; });
    sortItemListByDate(items);

    var afterNow = false, jumpHere = false;
    var currentTime = moment();

    items = items.map(function(item, idx) {
      // items are sorted by date
      // at first item that is after the current time, add anchor
      if (afterNow===false && currentTime.isBefore(moment(item.date + " " + item.start_time, datetime_formats))){
        afterNow = true;
        jumpHere = true;
      } else if (afterNow){
        // then stop adding anchor
        jumpHere = false;
      }
      return [
        <ListItem
          item={item}
          key={item.id}
          jumpHere={jumpHere}
          liked={this.props.likes.indexOf(item.id) !== -1}
          toggleLike={this.props.toggleLike.bind(null, item.id, this.props.uuid)}
          isRecommended={true}
        />,
      <hr className="item-divider" key={idx + 'hr'} />
      ];
    }, this);
    if (items.length === 0) {
      items = (<div><h3>Want personalized recommendations?</h3><p>From the "All Sessions" tab on the left, clicking on any star will add relevant recommendations in this tab.</p></div>);
    }
    return (
      <div>
        {items}
      </div>
    );
  }
});

var ViewFavorites = React.createClass({
  componentDidMount: function() {
    window.dispatchEvent(recommendationLoadEvent);
  },
  render: function() {
    var items =
        this.props.items.filter(function(item) {
          return this.props.likes.indexOf(item.id) !== -1;
        }, this).map(function(item, idx) {
          return [
            <ListItem
              item={item}
              key={item.id}
              liked={true}
              toggleLike={this.props.toggleLike.bind(null, item.id, this.props.uuid)}
              isRecommended={false}
            />,
          <hr className="item-divider" key={idx + 'hr'} />
          ];
        }, this);
    if (items.length == 0) {
      items = (<div><h3>Want to save your favorite talks?</h3><p>From the "All Sessions" tab on the left, clicking on any star will add talks to this list.</p></div>);
    }
    return (
      <div>
        {items}
      </div>
    );
  }
});

var TabHeader = React.createClass({
  render: function() {
    var countSpan = this.props.items ? <span>{this.props.items}</span> : null;
    return (
      <span>
        {this.props.icon ?
          <i className={"icon-small icon-" + this.props.icon} /> :
            null
        }
        <span style={{marginLeft:"2px"}}>{this.props.text} </span>
        { this.props.showCount ?
          <div style={{display:'inline-block', width:'16px', height: 'none'}} >
            {countSpan}
          </div> :
          null
        }
      </span>
    );
  }
});

var Tabs = React.createClass({
  mixins: [PureRenderMixin],
  render: function() {
    var tabs = {
      '/': <TabHeader text="All Sessions" />,
      '/recommended': <TabHeader
                        icon="thumbs-up"
                        text="Recommended"
                        items={this.props.recommended}
                        showCount={true}
                      />,
      '/favorites': <TabHeader
                        icon="star"
                        text="Favorites"
                        items={this.props.likes}
                        showCount={true}
                      />
    };
    return (
      <div className="tabs">
          <table>
            <tbody>
              <tr>
                {Object.keys(tabs).map(function(path, idx, arr) {
                  var tabName = tabs[path];
                  var selected = path === this.props.selectedTab;
                  return (
                    <td
                      key={path}
                      className={'text-center tab' + (selected ? '' : ' inactive')}
                      style={idx === 0 ? {borderLeft:'0'} :
                             null
                            }
                    >
                      <ReactRouter.Link to={path}>
                        {tabName}
                      </ReactRouter.Link>
                  </td>
                  );
                }, this)}
              </tr>
            </tbody>
          </table>
      </div>
    );
  }
});

var ListView = React.createClass({
  statics: {
    cachedItems: JSON.parse(localStorage.getItem('stratanow_predictiveservice_list_page_all')) || [],
    cachedUuid: localStorage.getItem(PredictiveService.url + '_stratanow_predictiveservice_list_page_uuid') || ''
  },
  mixins: [ReactRouter.State],
  getMoreElements: function(skip) {
    var limit = 10;
    var url = PredictiveService.url + 'stratanow_list_page';
    var data = {
      'api_key': PredictiveService.apikey,
      'data': {'input':{'skip': skip, 'limit': limit}}
    };

    var onSuccess = function(response) {

      // Append to state
      var oldItems = this.state.response;
      var newItems = response.response;
      items = oldItems.concat(newItems);

      // If there are more, get more elements.
      var continuation = function() {
        if (newItems.length < limit) {
          // finished, cache permanently
          ListView.cachedItems = items;
          ListView.cachedUuid = response.uuid;
          localStorage.setItem('stratanow_predictiveservice_list_page_all', JSON.stringify(items));
          localStorage.setItem('stratanow_predictiveservice_list_page_uuid', response.uuid);
          return;
        } else {
          this.getMoreElements(skip + limit);
        }
      }.bind(this);

      this.setState({response:items, uuid:response.uuid}, continuation);
    }.bind(this);

    $.ajax({
      url: url,
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        type: 'POST',
        data: JSON.stringify(data),
        success: onSuccess,
        error: function(xhr, status, err) {
          console.error(url, status, err.toString());
        }.bind(this)
    });
  },
  componentDidMount: function() {
    if (this.state.response.length === 0) {
      this.getMoreElements(0);
    }
  },
  getInitialState: function() {
    return {response: ListView.cachedItems, uuid: ListView.cachedUuid};
  },
  componentDidUpdate: function() {
    window.dispatchEvent(recommendationLoadEvent);
  },
  render: function() {
    return (
      <div className="container">
        <ReactRouter.RouteHandler
          toggleLike={this.props.toggleLike}
          likes={this.props.likes}
          items={this.state.response}
          recommended={this.props.recommended}
          uuid={this.state.uuid}
        />
      </div>
    );
  }
});

var TalkFocusView = React.createClass({
  mixins: [ReactRouter.State, PoweredByPredictiveService('stratanow_item_sim', function(data) {
    data.data.input['item_ids'] = [this.getParams().talkId];
    data.data.input['how_many'] = 10;
  }, function(data) {
    data.response.uuid = data.uuid;
    this.setState(data.response);
  })],
  getInitialState: function() {
    return {uuid: '',
            focus: {'id': 0, 'data':{'id':0, 'speakers':[], 'tech_tags': []}},
            recommended: []};
  },
  componentDidMount: function() {
    window.dispatchEvent(recommendationLoadEvent);
  },
  render: function() {
    var similar_items = this.state.recommended;
    similar_items = similar_items.map(function(item, idx) { return item.data; });
    similar_items = similar_items.slice(0, 5);
    sortItemListByDate(similar_items);

    var is_Recommended = getRecommendationFilterFunction(this.props.recommended);

    var transform_item = function(item, index) {
      return [
        <ListItem
          item={item}
          key={item.id}
          liked={this.props.likes.indexOf(item.id) !== -1}
          toggleLike={this.props.toggleLike.bind(null, item.id, this.state.uuid)}
          isRecommended={is_Recommended(item.id)}
        />,
        <hr key={index + "hr"} />
      ];
    }.bind(this);
    var focusItem = this.state.focus.data;
    var techs;
    if (focusItem !== undefined) {
      techs = (<div/>);
      // techs = focusItem.tech_tags.map(function(x, idx) {
      //   return (<li key={x}><span className="label label-default">{x}</span></li>);
      // });
    }
    return (
      <div>
        <FocusTalk
          item={focusItem}
          speakers={focusItem.speakers}
          techs={techs}
          liked={this.props.likes.indexOf(focusItem.id) !== -1}
          toggleLike={this.props.toggleLike.bind(null, focusItem.id, this.state.uuid)}
          isRecommended={is_Recommended(focusItem.id)}
        />
        <div className="container">
          <h3>If you like this, might you also like...</h3>
          {similar_items.map(transform_item)}
        </div>
      </div>
    );
  }
});

var SpeakerRecommendations = React.createClass({
  mixins: [PoweredByPredictiveService('stratanow_item_sim', function(data) {
    console.assert(this.props.talkIds.length > 0);
    data.data.input['item_ids'] = this.props.talkIds;
    data.data.input['how_many'] = 10;
  }, function(data) {
    this.setState(data);
  })],
  getInitialState: function() { return {}; },
  render: function() {
    if (!('response' in this.state)) { return null; }
    var is_Recommended = getRecommendationFilterFunction(this.props.recommended);
    return (
      <div>
        {this.state.response.recommended.map(function(item, idx) {
          return [
            <ListItem
              item={item.data}
              key={item.data.id}
              liked={this.props.likes.indexOf(item.data.id) !== -1}
              toggleLike={this.props.toggleLike.bind(null, item.data.id, this.props.uuid)}
              isRecommended={is_Recommended(item.data.id)}
            />,
            <hr key={idx + "hr"} />
          ];
        }, this)}
      </div>
    );
  }
});

var SpeakerFocusView = React.createClass({
  mixins: [ReactRouter.State, PoweredByPredictiveService('stratanow_speaker', function(data) {
    data.data.input['id'] = this.getParams().speakerId;
    data.data.input['how_many'] = 10;
  }, function(data) {
    this.setState(data);
  })],
  getInitialState: function() {
    return { uuid: '', response: { data: {}, talk_ids: [] }}
  },
  componentDidMount: function() {
    window.dispatchEvent(recommendationLoadEvent);
  },
  render: function() {
    var recs = null;
    if (this.state.uuid !== '') {
      recs = (
        <SpeakerRecommendations
          talkIds={this.state.response.talk_ids}
          uuid={this.state.uuid}
          likes={this.props.likes}
          toggleLike={this.props.toggleLike}
          recommended={this.props.recommended}
        />
      );
    }
    return (
      <div>
        <FocusSpeaker item={this.state.response.data} />
        <div className="container">
          <h3>Events related to this speaker's talk...</h3>
          {recs}
        </div>
      </div>
    );
  }
});

var Navbar = React.createClass({
  mixins: [ReactRouter.State, PureRenderMixin],
  statics: {
    openAboutOverlay: function(e) {
      $('#about_overlay').toggleClass('hidden');
    }
  },
  render: function() {
    return (
      <nav className="navbar navbar-inverse navbar-fixed-top" role="navigation">
        <div className="cml-colorbar-top-container">
          <table className="cml-colorbar-top" width="100%" border="0" cellSpacing="0" cellPadding="0">
            <tbody><tr>
              <td width="20%" style={{backgroundColor:"#B0007F"}}></td>
              <td width="20%" style={{backgroundColor:"#0A8CC4"}}></td>
              <td width="20%" style={{backgroundColor:"#85BD00"}}></td>
              <td width="20%" style={{backgroundColor:"#FF5500"}}></td>
              <td width="20%" style={{backgroundColor:"#5E5555"}}></td>
            </tr></tbody>
          </table>
        </div>
          <div className="row">
            <div className="col-xs-8">
              <ReactRouter.Link className="navbar-brand" to="list">
                <div id="strata-logo"></div>
              </ReactRouter.Link>
            </div>
            <div className="col-xs-4">
              <a href="javascript:" onClick={Navbar.openAboutOverlay}>
                <div id="dato-logo"></div>
              </a>
            </div>
          </div>
        <Tabs
          selectedTab={this.props.selectedTab}
          likes={this.props.likes.length}
          recommended={this.props.recommended.length}
        />
      </nav>
    );
  }
});

var App = React.createClass({
  mixins: [ReactRouter.State],
  statics: {
    getLikesFromLocalStorage: function() {
      return Object.keys(localStorage).filter(function(key) {
        return key.indexOf(storagePrefix) !== -1;
      }).map(function(key) {
        return key.split(storagePrefix)[1];
      });
    }
  },
  getInitialState: function() {
    var likes = App.getLikesFromLocalStorage();
    return {
      likes: likes,
      recommended: []
    };
  },
  componentDidMount: function() {
    if (this.state.likes.length > 0) {
      this.fetchUserRecommendations();
    }
    this.debouncedFetch = debounceFunc(this.fetchUserRecommendations,300);
  },
  fetchUserRecommendations: function() {
    var item_ids = this.state.likes;
    if (item_ids.length === 0) {
      if (this.state.recommended.length > 0) {
        // don't bother round-tripping if we have no data
        this.setState({recommended: []});
      }
      return;
    }
    var url = PredictiveService.url + 'stratanow_item_sim';
    var how_many = getHowManyRecsNeeded(item_ids);
    var data = {
      'api_key': PredictiveService.apikey,
      'data': {'input':{'item_ids': item_ids,
                        'how_many': how_many}}
    };
    $.ajax({
      url: url,
      dataType: 'json',
      contentType: "application/json; charset=utf-8",
      type: 'POST',
      data: JSON.stringify(data),
      success: function(data) {
        // TODO how to handle uuid here?
        this.setState({recommended: data.response.recommended});
      }.bind(this),
      error: function(xhr, status, err) {
        console.error(url, status, err.toString());
      }.bind(this)
    });
  },
  toggleItemLike: function(id, uuid) {
    var likes = this.state.likes;
    var liked = this.state.likes.indexOf(id) !== -1;
    var action = liked ? 'unlike' : 'like';
    sp_client('trackStructEvent', 'strata_recs', action, id, uuid, '0.0');
    ga('send', 'event', 'talk', action, id);
    if (liked) {
      localStorage.removeItem(storagePrefix + id);
      likes.splice(this.state.likes.indexOf(id),1);
    } else {
      localStorage.setItem(storagePrefix + id, 'true');
      likes.push(id);
    }
    this.setState({likes : likes},function(){
       this.debouncedFetch.call(this);
    });
  },
  getHandlerKey: function() {
    var path = this.getPathname();
    var params = this.getParams();
    if (('speakerId' in params) || ('talkId' in params)) {
      return path + '/' + JSON.stringify(params);
    }
    return '';
  },
  render: function() {
    return (
      <div>
        <Navbar
          selectedTab={this.getPathname()}
          likes={this.state.likes}
          recommended={this.state.recommended}
        />
        <ReactRouter.RouteHandler
          likes={this.state.likes}
          recommended={this.state.recommended}
          toggleLike={this.toggleItemLike}
          key={this.getHandlerKey()}
        />
        <footer>
          <h3>Recommender built by Dato using GraphLab Create.<br/>
          <a href="http://go.dato.com/if-you-like-the-strata-recommender-why-not-make-your-own">Want to build your own?</a>
          </h3>
          <a href="http://go.dato.com/if-you-like-the-strata-recommender-why-not-make-your-own">
            <div id="dato-footer-logo"/>
          </a>
        </footer>
      </div>
    );
  }
});

var routes = (
  <ReactRouter.Route name="app" path="/" handler={App}>
    <ReactRouter.Route name="talk" path="talk/:talkId" handler={TalkFocusView} />
    <ReactRouter.Route name="speaker" path="speaker/:speakerId" handler={SpeakerFocusView} />
    <ReactRouter.Route name="list" path="/" handler={ListView}>
      <ReactRouter.Route name="recommended" path="recommended" handler={ViewRecommended} />
      <ReactRouter.Route name="favorites" path="favorites" handler={ViewFavorites} />
      <ReactRouter.Route name="all" path="/" handler={ViewAll} />
    </ReactRouter.Route>
  </ReactRouter.Route>
);

var renderApp = function() {
  React.initializeTouchEvents(true);
  ReactRouter.run(routes, function (Handler, state) {
    ga('send', 'pageview', {
      'page': state.path
    });
    // Perf.start();
    React.render(<Handler/>, document.getElementById('all_content'));
    // Perf.stop();
    // Perf.printWasted();
    onFirstLoad();
  });
};

$(renderApp);

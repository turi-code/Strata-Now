import graphlab as gl

def create_ps(LOG_PATH, PS_PATH):
    """
    Create a PredictiveService with given S3 paths for logs and the service.
    """

    try:

        if PROD:
          e = gl.deploy.environment.EC2('ec2-env', LOG_PATH,
                                        region='us-west-2', num_hosts=3)
          ps = gl.deploy.predictive_service.create('strata-now',
                                                   e, PS_PATH)
        else:
          e = gl.deploy.environment.EC2('ec2-env-tmp', LOG_PATH,
                                        region='us-west-2', num_hosts=1)

          ps = gl.deploy.predictive_service.create('strata-now-test',
                                                   e, PS_PATH)

        ps.set_CORS("*")
    except:
        ps = gl.deploy.predictive_service.load(PS_PATH)
        print ps
    return ps

def parse_details(filename):
    """
    Given an SArray containing the details of each talk, clean up the abstracts
    and create a unique id for each event.
    """
    details = gl.SArray(filename)[0]
    details = gl.SFrame({'url_suffix': details.keys(),
                         'data': details.values()})
    details = details.unpack('data', column_name_prefix='')
    details['id'] = details['url'].apply(lambda x: x.split('/')[-1])
    details['abstract'] = details['abstract'].apply(lambda x: x.replace('Description', ''))
    details['abstract'] = details['abstract'].apply(lambda x: x.replace('THIS TUTORIAL HAS REQUIREMENTS AND INSTRUCTIONS LISTED BELOW',''))
    return details


def parse_speakers(filename):
    """
    Clean up the description for each speaker.
    """
    speakers = gl.SArray(filename)[0]
    speakers = gl.SFrame({'url_suffix': speakers.keys(),
                          'data': speakers.values()})

    def clean_bio(y):
        x = y['bio']
        x = x.replace('Website', '')
        x = x.replace('| Attendee Directory', '')
        x = x.replace('Profile', '')
        x = x.replace('\n', ' ')
        x = x.replace('\r', '')
        y['bio'] = x.strip()
        return y

    speakers['data'] = speakers['data'].apply(clean_bio)

    sdict = {}
    for s in speakers:
        k = s['url_suffix']
        sdict[k] = s['data']

    return sdict, speakers

def clean_timing(details):
    """
    Clean up the timing information.
    """
    def split_time(row):
        x = row['timing']
        x = x.replace('  ', ' ')
        parts = x.split(' ')
        t = parts[0]
        start_time, end_time = t.strip().split('\xe2\x80\x93')
        dow = parts[1].split(',')[0]
        date = parts[2]
        return {'start_time': start_time.strip(),
                'end_time': end_time.strip(),
                'dow': dow,
                'date': date}
    details['timing_details'] = details.apply(split_time)
    details = details.unpack('timing_details', column_name_prefix='')
    return details

def build_nn_model(details):
    """
    Create a nearest neighbors model based on the similarity between TF-IDF-
    transformed bag-of-words representations for each abstract.
    """

    # Transform text to tfidf
    g = details[['id', 'abstract']]
    g['bow'] = gl.text_analytics.count_words(g['abstract'])
    g = gl.feature_engineering.TFIDF('bow').fit_transform(g)
    g.rename({'bow': 'tfidf'})

    # Build a nearest neighbor model and get 50 nearest nearbors
    nn_model = gl.nearest_neighbors.create(g, label='id', features=['tfidf'])
    nearest = nn_model.query(g, label='id', k=50)
    return nn_model, nearest

def create_details_dict(details):
    """
    Create a dictionary from the SFrame so that we can look up information by
    the id of the event. Also return a trimmed version that contains less data.
    """

    details_dict = {}
    for d in details:
        details_dict[d['id']] = d

    trimmed = {}
    for k, v in details_dict.iteritems():
        trimmed[k] = {}
        for z in ['id', 'title', 'abstract', 'date', 'start_time', 'end_time', 'dow']:
            trimmed[k][z] = v[z]
        spkrs = []
        for spkr in v['speakers']:
            spkrs.append({'name': spkr['name'],
                           'url': spkr['url']})
        trimmed[k]['speakers'] = spkrs
    return details_dict, trimmed



def create_nn_dict(details, details_dict, speakers_dict, nearest):
    """
    Create a dictionary where that contains, for each event:
    - the nearest events according to the nearest neighbors model
    - all the metadata for each of those events
    - all the speaker data for each event
    """

    nearest = nearest.rename({'reference_label': 'id'})
    nearest = nearest.join(details, on='id')
    nearest = nearest[nearest['distance'] > 0]
    results = gl.SFrame({'id': nearest['query_label'],
                         'data': nearest.pack_columns(dtype=dict)['X1']})
    results = results.groupby('id', {'data':gl.aggregate.CONCAT('data')})

    # Construct joined result.
    res = {}
    for r in results:
        id = r['id']
        d = details_dict[id]
        d['speakers'] = [speakers_dict[j] for j in d['speaker_urls']]
        nearest = list(r['data'])
        for n in nearest:
            n['speakers'] =  [speakers_dict[j] for j in n['speaker_urls']]


        res[id] = {'details': d,
                   'nearest': nearest}

    return res

def join_speaker_data_into_details(details, speakers):
    """
    Modify the SFrame containing information about each talk to also contain
    the metadata for each talk.
    """

    speakers = speakers.rename({'url_suffix':'speaker_id'})

    sp = details[['id', 'speaker_urls']]
    sp = sp.stack('speaker_urls', new_column_name='speaker_id')
    sp = sp.join(speakers, on='speaker_id')
    speakers_per_talk = sp[['id', 'data']].unstack('data', new_column_name='speakers')
    details = details.join(speakers_per_talk, on='id')

    talks_per_speaker = sp.groupby('speaker_id', {'talk_ids': gl.aggregate.CONCAT('id')})\
                          .join(speakers, on='speaker_id')
    talks_per_speaker['id'] = talks_per_speaker['speaker_id'].apply(lambda x: x.split('/')[-1])
    talks_per_speaker = talks_per_speaker.rename({'speaker_id': 'speaker_url_suffix'})

    return details, talks_per_speaker



def compare_items(a, b):
    """
    Helper function for sorting events by time.
    """

    from datetime import datetime
    ad = a['date'] + ' ' + a['start_time']
    bd = b['date'] + ' ' + b['start_time']

    for s in ["%m/%d/%Y %I:%M%p", "%m/%d/%Y %I%p", "%m/%d/%Y %I:%M",
              "%m/%d/%Y %H:%M%p", "%m/%d/%Y %H%p", "%m/%d/%Y %H:%M"]:

        print s, ad
        try:
            ad = datetime.strptime(ad, s)
            break
        except:
            continue

    for s in ["%m/%d/%Y %I:%M%p", "%m/%d/%Y %I%p", "%m/%d/%Y %I:%M",
              "%m/%d/%Y %H:%M%p", "%m/%d/%Y %H%p", "%m/%d/%Y %H:%M"]:

        print s, bd
        try:
            bd = datetime.strptime(bd, s)
            break
        except:
            continue

    if isinstance(ad, str) or isinstance(bd, str):
        raise ValueError("Could not convert dates")

    # print ad, bd
    if ad < bd:
        return -1
    elif bd < ad:
        return 1
    else:
        if 'rank' in a and 'rank' in b:
            if a['rank'] < b['rank']:
                return -1
            elif a['rank'] > b['rank']:
                return 1
    return 0

def upload_list_page(ps, trimmed):
    """
    Upload the list of events, sorted by time.
    """

    from itertools import islice

    trim = trimmed.values()
    sorted_trim = sorted(trim, cmp=compare_items)

    def list_page(input):
        limit = input['limit']
        skip = input['skip']
        assert limit > 0
        assert skip >= 0 and skip < len(trimmed)
        res = list(islice(iter(sorted_trim), skip, skip+limit))
        list_page.log(query_result=res)
        return res

    if 'list_page' not in ps.deployed_predictive_objects:
        ps.add('list_page', list_page)
    else:
        ps.update('list_page', list_page)
    ps.apply_changes()


def upload_speaker(ps, talks_per_speaker):
    """
    Upload speaker data as well as their talks.
    """

    # Pack speaker data into a dictionary type column
    key_column = 'id'
    d = talks_per_speaker.pack_columns(dtype=dict, new_column_name='data')
    d['id'] = talks_per_speaker['id']

    # Copy into a dictionary whose keys are speaker ids
    res = {}
    for row in d:
        res[row[key_column]] = row['data']

    def query(input):
        result = res[input['id']]
        query.log(context_id='my_context_id', query_result=result)
        return result

    if 'speaker' not in ps.deployed_predictive_objects:
        ps.add('speaker', query)
    else:
        ps.update('speaker', query)
    ps.apply_changes()

    return {'ps': ps}

def upload_item_sim(ps, details, m, nearest):
    """
    Build a recommendation model from the nearest neighbor graph of events.

    The model will use the nearest neighbors to make recommendations of new
    events based on their similarity to a list of events. This list might
    be the list of favorites for a given user, a list of talks a speaker has
    given, or simply a single event (list of length 1).

    We build a custom predictive object that depends on the model to make
    recommendations, then joins those recommendations to the event metadata,
    then creates a custom predictive object that serves these.

    Finally we launch this model as a predictive service.
    """

    sf = gl.SFrame({'user_id': ['0'], 'item_id': ['0']})

    nearest = nearest.rename({'query_label': 'item_id',
                              'reference_label':'similar',
                              'distance': 'score'})
    nearest = nearest[nearest['score'] > 0]
    nearest['score'] = 1 - nearest['score']

    # Build a recommender model
    m = gl.item_similarity_recommender.create(sf, nearest_items=nearest)

    # Create a custom predictive object
    def query(input):
        items = input['item_ids']
        K = input['how_many']
        obsdata = gl.SFrame({'user_id': gl.SArray.from_const('1', len(items)),
                             'item_id': items})

        # Get recommendations for a user with this data
        recs = m.recommend(users=['1'], new_observation_data=obsdata, k=K)

        # Join item details
        recs = recs.rename({'item_id': 'id'})
        recs = recs.join(details, on='id').sort('date')
        recs = gl.SFrame({'id': recs['id'],
                          'data': recs.pack_columns(dtype=dict)['X1']})

        # Input
        inp = gl.SFrame({'id': items})
        inp = inp.join(details, on='id')
        inp = gl.SFrame({'id': inp['id'],
                         'data': inp.pack_columns(dtype=dict)['X1']})
        def to_dict(sf):
            return list(sf.pack_columns(dtype=dict)['X1'])

        result = {'focus': to_dict(inp)[0],
                  'recommended': to_dict(recs)}
        query.log(context_id='my_context_id', query_result=result)
        return result

    # Deploy the model
    if 'item_sim' not in ps.deployed_predictive_objects:
        ps.add('item_sim', query)
    else:
        ps.update('item_sim', query)
    ps.apply_changes()



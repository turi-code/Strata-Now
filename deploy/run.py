import graphlab as gl
from models  import *


path = "s3://gl-demo-usw2/predictive_service/demolab/ps-1.6"
ps = gl.deploy.predictive_service.load(path)

# Define dependencies
state = {'details_filename': '../data/talks.json',
         'speakers_filename': '../data/speakers.json',
         'details_sf': '../data/talks.gl',
         'speakers_sf': '../data/speakers.gl'}

# Data carpentry
details = parse_details(state['details_sf'])
speakers_dict, speakers = parse_speakers(state['speakers_sf'])
details = clean_timing(details)
details, talks_per_speaker = join_speaker_data_into_details(details, speakers)
details_dict, trimmed = create_details_dict(details)

# Create nearest neighbor model and get nearest items
nn_model, nearest = build_nn_model(details)

# Deploy models as a predictive service
upload_list_page(ps, trimmed)
upload_speaker(ps, talks_per_speaker)
upload_item_sim(ps, details, nn_model, nearest)

#########################################################
# Ad hoc testing

# Via Python client
print ps.query('stratanow_item_sim', input={'item_ids': ['43169'], 'how_many':5})

# Via Curl
# !curl -X POST -d '{"api_key": "b9b8dd75-a6d3-4903-b6a7-2dc691d060d8", "data":{"input": {"item_ids":["43750"], "how_many": 5}}}' stratanow-175425062.us-west-2.elb.amazonaws.com/data/item_sim



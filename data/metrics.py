import graphlab as gl
import urlparse

settings = {'client_log': 's3://dato-demo-metrics/client-logs',
            'server_log_old': 's3://gl-testing-chris/log/strata-predictive-service-three_logs',
            'server_log_old2': 's3://dato-stratanow/logs/stratanow_logs',
            'server_log': 's3://dato-stratanow/log/strata-now_logs'}


def process_client(settings):
    # Process client logs
    client_logs  = gl.SFrame.read_csv(settings['client_log'] + '/*.gz',
        comment_char='#', delimiter='\t', header=False)
    def parse_query_string(x):
        return {k : v[0] for (k,v) in urlparse.parse_qs(x).iteritems()}
    client_logs['params'] = client_logs['X12'].apply(lambda x: parse_query_string(x))
    client_logs = client_logs.unpack('params')
    client = client_logs[[c for c in client_logs.column_names() if c.startswith('params.se')]]
    colnames = {k: k.replace('params.se_','') for k in client.column_names()}
#duid = user id
    client = client.rename(colnames)
    client['user'] = client_logs['params.duid']
    client['date'] = client_logs['X1']
    client['time'] = client_logs['X2']
    client = client.rename({'pr': 'uuid',
                            'ac': 'event_type',
                            'la': 'item_id'})

    return client

def process_server(settings):
    server_logs  = gl.SFrame.read_csv(settings['server_log'] + '/*custom.log', header=False)
    return server_logs.unpack('X2', column_name_prefix='')\
                      .unpack('data', column_name_prefix='')

clientlogs = process_client(settings)
clientlogs.tail()
serverlogs = process_server(settings)
serverlogs.tail()

historical = serverlogs.join(clientlogs, on='uuid')

c = clientlogs[clientlogs['event_type']=='like']
c = c.rename({'user':'user_id'})
c = c.groupby(['user_id', 'item_id'], {})
train,test=gl.recommender.util.random_split_by_user(c)
m = gl.recommender.create(train)
m.evaluate(test)

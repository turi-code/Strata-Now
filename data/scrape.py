from bs4 import BeautifulSoup
import requests
import json
import graphlab as gl

def clean(s):
    return s.getText().encode('utf-8').strip()

def parse_detail_url(url_suffix):
    url = 'http://strataconf.com/' + url_suffix
    page = BeautifulSoup(requests.get(url).content)
    info = {}

    d = page.find('h1', 'summary')
    info['title'] = clean(d)
    info['url'] = url
    d = page.find('span', 'en_session_topics')
    if d is not None:
        info['topics'] = clean(d)
    d = page.find('span', 'location')
    if d is not None:
        info['room'] = clean(d)
    d = page.find('div', 'session_time')
    if d is not None:
        info['timing'] = clean(d)
    d = page.find('div', 'en_session_description')
    if d is not None:
        info['abstract'] = clean(d)
    speaker_links = page.select('a[href^="/big-data-conference-ny-2015/public/schedule/speaker/"]')
    info['speaker_urls'] = [link.get('href') for link in speaker_links]
    return info

def parse_speaker_url(url_suffix):
    url = 'http://strataconf.com/' + url_suffix
    page = BeautifulSoup(requests.get(url).content)
    info = {}
    info['url'] = url
    d = page.find('div', 'en_speaker_bio note')
    info['bio'] = clean(d)
    d = page.find('div', 'en_user_photo')
    if d is not None:
        info['imgsrc'] = d.find('img').get('src')
    d = page.find('span', 'info')
    if d is not None:
        info['info'] = clean(d)
    d = page.find('h1')
    if d is not None:
        info['name'] = clean(d).split('\n')[0].strip()
    return info


if __name__ == "__main__":

    # Get detail ids from ical
    detail_ids = []
    x = requests.get('http://strataconf.com/big-data-conference-ny-2015/public/schedule/ical')
    for line in x.content.split('\n'):
        if line.startswith(' --'):
            detail_ids.append(line.split(' --')[1].strip())

    # For each detail, make a list of speakers
    detail_urls = ['big-data-conference-ny-2015/public/schedule/detail/' + id
                    for id in detail_ids]

    # Scrape sponsors
    url = 'http://strataconf.com/big-data-conference-ny-2015/public/content/sponsors'
    page = BeautifulSoup(requests.get(url).content)
    sponsor_elements = page.find_all('div', 'sponsor-blurb')
    sponsors = {}
    for d in sponsor_elements:
        sponsor = {}
        sponsor['url'] = d.find('span', 'company_name').find('a').get('href')
        sponsor['company_name'] = d.find('span', 'company_name').getText()
        sponsor['blurb'] = d.find('p').getText()
        sponsor['imgsrc'] = d.find('img').get('src')
        sponsors[sponsor['company_name']] = sponsor

    # Test parsing functions
    b = parse_detail_url(detail_urls[0])

    # Crawl talks
    details = {}
    for url in detail_urls:
        if url not in details:
            print url
            details[url] = parse_detail_url(url)

    # Get all speaker urls
    speaker_urls = []
    for id, d in details.iteritems():
        speaker_urls.extend(d['speaker_urls'])

    # Crawl speakers
    speakers = {}
    for url in speaker_urls:
        if url not in speakers:
            print url
            speakers[url] = parse_speaker_url(url)

    gl.SArray([details]).save('talks.gl')
    gl.SArray([speakers]).save('speakers.gl')
    gl.SArray([sponsors]).save('sponsors.gl')

    # Write data to files
    with open('talks.json', 'wb') as o:
        json.dump(details, o)

    with open('speakers.json', 'wb') as o:
        json.dump(speakers, o)

    with open('sponsors.json', 'wb') as o:
        json.dump(sponsors, o)

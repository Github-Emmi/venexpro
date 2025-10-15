from django.http import HttpResponse, HttpResponseRedirect
from django.core.mail import send_mail
from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.template import loader
from django import template

# Create your views here.

###########################################################
     #Landing Page views
###########################################################

def index(request):
    return render(request, 'jobs/index.html', {})

def about(request):
     return render(request, 'about.html', {})

def started(request):
     return render(request, 'started.html', {}) 

def faq(request):
     return render(request, 'faq.html', {})

def affiliate(request):
     return render(request, 'affiliate.html', {})

def terms(request):
     return render(request, 'terms.html', {})              

def contact(request):
     return render(request, 'jobs/contact.html', {})   

def sent(request):
     if request.method == "POST":
          message_name = request.POST['name']
          message_email = request.POST['email']
          message = request.POST['message']
          # send an email 
          send_mail(
               'New message from ' + message_name, 
               message,
               message_email,
               ['venexltd@gmail.com', 'aghason.emmanuel@gmail.com'],
          )
          return render(request, 'jobs/sent.html', {
               'message_name': message_name,
               ' message_email': message_email,
               'message' : message,
               })
     else:
          return render(request,'jobs/index.html')  

def signup(request):
     return render(request, 'jobs/signup.html', {})              

def user_login(request):
     return render(request, 'jobs/login.html', {})
      
def DoLogin(request):
    if request.method != "POST":
        return HttpResponse('<h2>Method Not Allowed</h2>')
    else:
        user = authenticate(request,username=request.POST.get("email"), password=request.POST.get("password"))
        if user!=None:
            login(request, user) 
            return HttpResponseRedirect("jobs/admin_templates/account.html")           
        else:
            messages.error(request, 'Invalid email or password')
            return HttpResponseRedirect("/login")
           


####################################################################

          #Error page Catcher

####################################################################

@login_required(login_url="/login/")
def pages(request):
    context = {}
    # All resource paths end in .html.
    # Pick out the html file name from the url. And load that template.
    try:
        
        load_template = request.path.split('/')[-1]
        html_template = loader.get_template( load_template )
        return HttpResponse(html_template.render(context, request))
        
    except template.TemplateDoesNotExist:

        html_template = loader.get_template( 'jobs/page-404.html' )
        return HttpResponse(html_template.render(context, request))

    except:
    
        html_template = loader.get_template( 'jobs/page-500.html' )
        return HttpResponse(html_template.render(context, request))
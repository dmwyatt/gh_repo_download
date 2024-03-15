from django import forms

class RepositoryForm(forms.Form):
    repo_url = forms.URLField(label='GitHub Repository URL')
